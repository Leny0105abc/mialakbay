import { z } from 'zod';
import type { DB } from './db';
import type { Booking, User, Promotion, PaymentSubmission, Tour, Departure } from './types';
import { AppError, audit, hashToken, token, staff } from './security';
import { itinerary, TOUR_SELECT } from './data';
export const quoteSchema = z.object({
  departure_id: z.string().min(1),
  adults: z.coerce.number().int().min(1).max(100),
  children: z.coerce.number().int().min(0).max(100).default(0),
  code: z.string().trim().max(40).default(''),
});
export const bookingSchema = quoteSchema.extend({
  contact_name: z.string().trim().min(2).max(120),
  contact_email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  contact_phone: z.string().trim().min(7).max(30),
  payment_method: z.enum(['GCASH', 'MAYA', 'BANK', 'CASH']),
  travelers: z
    .array(z.object({ name: z.string().trim().min(2).max(120), type: z.enum(['ADULT', 'CHILD']) }))
    .max(100),
  accepted_terms: z.literal(true),
});
export const submissionSchema = z.object({
  amount: z.coerce.number().int().positive().max(1000000000),
  method: z.enum(['GCASH', 'MAYA', 'BANK', 'CASH']),
  reference: z.string().trim().min(4).max(100),
});
export async function expireHolds(db: DB) {
  await db.transaction(async (tx) => {
    const rows = (
      await tx.query<Booking>(
        "SELECT * FROM bookings WHERE expires_at<now() AND status IN ('PENDING_REVIEW','PENDING_PAYMENT') AND NOT seats_released FOR UPDATE",
      )
    ).rows;
    for (const b of rows) {
      await tx.query('UPDATE departures SET reserved=reserved-$1 WHERE id=$2', [
        b.adults + b.children,
        b.departure_id,
      ]);
      await tx.query(
        "UPDATE bookings SET status='CANCELLED',seats_released=true,cancellation_reason='Unpaid reservation expired after 48 hours.',updated_at=now() WHERE id=$1",
        [b.id],
      );
      await notify(
        tx,
        b.user_id,
        b.id,
        'Reservation expired',
        `${b.reference}: the unpaid reservation expired and its seats have been released.`,
      );
    }
  });
}
export async function notify(
  db: DB,
  userId: string | null,
  bookingId: string | null,
  title: string,
  message: string,
  recipientEmail?: string,
) {
  await db.query(
    'INSERT INTO notifications(user_id,booking_id,title,message,email_status,recipient_email) VALUES($1,$2,$3,$4,$5,$6)',
    [
      userId,
      bookingId,
      title,
      message,
      process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? 'PENDING' : 'NOT_CONFIGURED',
      recipientEmail || null,
    ],
  );
}
export async function quote(db: DB, raw: unknown) {
  const input = quoteSchema.parse(raw);
  const departure = (
    await db.query<Departure>('SELECT * FROM departures WHERE id=$1', [input.departure_id])
  ).rows[0];
  if (!departure || !departure.available || new Date(departure.booking_deadline) <= new Date())
    throw new AppError('This departure is closed. Please choose another date.');
  const pkg = (
    await db.query<Tour>(TOUR_SELECT + " WHERE p.id=$1 AND p.status='PUBLISHED'", [
      departure.package_id,
    ])
  ).rows[0];
  if (!pkg) throw new AppError('This package is not currently available.');
  const count = input.adults + input.children;
  if (count < pkg.min_participants || count > pkg.max_participants)
    throw new AppError(
      `This package accepts ${pkg.min_participants}–${pkg.max_participants} travelers per reservation.`,
    );
  if (count > departure.capacity - departure.reserved)
    throw new AppError('There are not enough seats for your group.');
  const adultPrice = pkg.adult_price + departure.price_adjustment,
    childPrice = pkg.child_price + departure.price_adjustment;
  if (adultPrice <= 0 || childPrice < 0) throw new AppError('Pricing needs staff review.');
  const subtotal = adultPrice * input.adults + childPrice * input.children;
  let promotion: Promotion | undefined,
    discount = 0;
  if (input.code) {
    promotion = (
      await db.query<Promotion>('SELECT * FROM promotions WHERE code=$1', [
        input.code.toUpperCase(),
      ])
    ).rows[0];
    if (
      !promotion ||
      !promotion.active ||
      new Date(promotion.starts_at) > new Date() ||
      new Date(promotion.ends_at) < new Date() ||
      promotion.used >= promotion.usage_limit ||
      subtotal < promotion.min_total
    )
      throw new AppError(
        'This promotion is not valid for this reservation. Check its dates, minimum spend and usage limit.',
      );
    const eligible = (
      await db.query<{ package_id: string }>(
        'SELECT package_id FROM promotion_packages WHERE promotion_id=$1',
        [promotion.id],
      )
    ).rows;
    if (eligible.length && !eligible.some((p) => p.package_id === pkg.id))
      throw new AppError('This promotion does not include this package.');
    discount =
      promotion.discount_type === 'PERCENT'
        ? Math.floor((subtotal * promotion.value) / 100)
        : promotion.value;
    discount = Math.min(discount, Math.max(0, subtotal - 100));
  }
  const total = subtotal - discount;
  return {
    subtotal,
    discount,
    total,
    deposit_due: Math.ceil((total * pkg.deposit_percent) / 100),
    adult_price: adultPrice,
    child_price: childPrice,
    promotion,
    pkg,
    departure,
  };
}
export async function createBooking(db: DB, raw: unknown, user: User | null) {
  const input = bookingSchema.parse(raw);
  if (
    input.travelers.filter((t) => t.type === 'ADULT').length !== input.adults ||
    input.travelers.filter((t) => t.type === 'CHILD').length !== input.children
  )
    throw new AppError('Please provide one name for every traveler.');
  if (user && user.email !== input.contact_email)
    throw new AppError('Use your account email for this reservation.');
  await expireHolds(db);
  const accessToken = token();
  const reference = `LKB-${new Date().getUTCFullYear()}-${token().slice(0, 8).toUpperCase()}`;
  const result = await db.transaction(async (tx) => {
    await tx.query('SELECT id FROM departures WHERE id=$1 FOR UPDATE', [input.departure_id]);
    const q = await quote(tx, input);
    const reserve = await tx.query(
      'UPDATE departures SET reserved=reserved+$1 WHERE id=$2 AND available AND booking_deadline>now() AND reserved+$1<=capacity',
      [input.adults + input.children, input.departure_id],
    );
    if (!reserve.affectedRows)
      throw new AppError('Those seats were just reserved. Please select another date.', 409);
    if (q.promotion) {
      const claim = await tx.query(
        'UPDATE promotions SET used=used+1 WHERE id=$1 AND used<usage_limit AND active AND starts_at<=now() AND ends_at>now()',
        [q.promotion.id],
      );
      if (!claim.affectedRows)
        throw new AppError('This promotion has reached its usage limit.', 409);
    }
    const snapshot = {
      title: q.pkg.title,
      destination: q.pkg.destination,
      departure_at: q.departure.departure_at,
      duration: q.pkg.duration,
      image_url: q.pkg.image_url,
      meeting_point: q.pkg.meeting_point,
      policies: q.pkg.policies,
      inclusions: q.pkg.inclusions,
      itinerary: await itinerary(q.pkg.id, tx),
      adult_price: q.adult_price,
      child_price: q.child_price,
    };
    const b = (
      await tx.insertSQL<Booking>(
        'INSERT INTO bookings(reference,user_id,departure_id,contact_name,contact_email,contact_phone,adults,children,subtotal,discount,total,deposit_due,payment_method,snapshot,guest_token_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now()+INTERVAL 48 HOUR)',
        [
          reference,
          user?.id || null,
          input.departure_id,
          input.contact_name,
          input.contact_email,
          input.contact_phone,
          input.adults,
          input.children,
          q.subtotal,
          q.discount,
          q.total,
          q.deposit_due,
          input.payment_method,
          JSON.stringify(snapshot),
          hashToken(accessToken),
        ],
      )
    ).rows[0];
    for (const t of input.travelers)
      await tx.query('INSERT INTO booking_travelers(booking_id,name,type) VALUES($1,$2,$3)', [
        b.id,
        t.name,
        t.type,
      ]);
    if (q.promotion)
      await tx.query('INSERT INTO promotion_usage(promotion_id,booking_id) VALUES($1,$2)', [
        q.promotion.id,
        b.id,
      ]);
    await notify(
      tx,
      user?.id || null,
      b.id,
      'Reservation received',
      `${reference} is pending payment. Your reservation is confirmed only after staff verifies the required deposit.`,
    );
    return b;
  });
  return { booking: result, accessToken };
}
export async function authorizedBooking(
  db: DB,
  reference: string,
  user: User | null,
  accessToken?: string,
  lock = false,
) {
  const b = (
    await db.query<Booking>(
      `SELECT * FROM bookings WHERE reference=$1 ${lock ? 'FOR UPDATE' : ''}`,
      [reference],
    )
  ).rows[0];
  if (!b) throw new AppError('Reservation not found or access denied.', 404);
  const owns = user && (b.user_id === user.id || ['SUPER_ADMIN', 'STAFF'].includes(user.role));
  if (
    !owns &&
    (b.user_id !== null || !accessToken || hashToken(accessToken) !== b.guest_token_hash)
  )
    throw new AppError('Reservation not found or access denied.', 404);
  b.paid = Number(
    (
      await db.query<{ total: string }>(
        "SELECT COALESCE(sum(CASE WHEN kind='PAYMENT' THEN amount ELSE -amount END),0) AS total FROM payments WHERE booking_id=$1",
        [b.id],
      )
    ).rows[0].total,
  );
  return b;
}
export async function submitPayment(
  db: DB,
  reference: string,
  raw: unknown,
  user: User | null,
  accessToken?: string,
) {
  const input = submissionSchema.parse(raw);
  return db.transaction(async (tx) => {
    const b = await authorizedBooking(tx, reference, user, accessToken, true);
    if (
      !['PENDING_PAYMENT', 'PENDING_REVIEW', 'PAYMENT_UNDER_REVIEW', 'CONFIRMED'].includes(b.status)
    )
      throw new AppError('This reservation cannot accept payment submissions.');
    if (
      b.expires_at &&
      new Date(b.expires_at) < new Date() &&
      b.paid === 0 &&
      b.status !== 'PAYMENT_UNDER_REVIEW'
    )
      throw new AppError('This reservation has expired. Please make a new reservation.');
    if (input.amount > b.total - b.paid)
      throw new AppError('The submitted amount exceeds the outstanding balance.');
    const pending = (
      await tx.query(
        "SELECT id FROM payment_submissions WHERE booking_id=$1 AND status='UNDER_REVIEW'",
        [b.id],
      )
    ).rows;
    if (pending.length)
      throw new AppError('A payment is already under review. Please wait for staff to review it.');
    try {
      await tx.query(
        'INSERT INTO payment_submissions(booking_id,amount,method,reference) VALUES($1,$2,$3,$4)',
        [b.id, input.amount, input.method, input.reference],
      );
    } catch (e) {
      if ((e as { code?: string }).code === 'ER_DUP_ENTRY')
        throw new AppError('This payment reference has already been submitted.');
      throw e;
    }
    await tx.query(
      "UPDATE bookings SET status='PAYMENT_UNDER_REVIEW',updated_at=now() WHERE id=$1",
      [b.id],
    );
    await notify(
      tx,
      b.user_id,
      b.id,
      'Payment under review',
      `${b.reference}: your payment reference is awaiting staff verification. It has not been recorded as received.`,
    );
  });
}
export async function reviewPayment(
  db: DB,
  id: string,
  approved: boolean,
  note: string,
  user: User | null,
) {
  staff(user);
  return db.transaction(async (tx) => {
    const row = (
      await tx.query<PaymentSubmission>('SELECT * FROM payment_submissions WHERE id=$1', [id])
    ).rows[0];
    if (!row) throw new AppError('Payment submission not found.', 404);
    const b = (
      await tx.query<Booking>('SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [row.booking_id])
    ).rows[0];
    const p = (
      await tx.query<PaymentSubmission>(
        'SELECT * FROM payment_submissions WHERE id=$1 FOR UPDATE',
        [id],
      )
    ).rows[0];
    if (p.status !== 'UNDER_REVIEW')
      throw new AppError('This payment has already been reviewed.', 409);
    if (!['PAYMENT_UNDER_REVIEW', 'REFUND_PENDING'].includes(b.status))
      throw new AppError('Review the reservation status before verifying payment.');
    const paid = Number(
      (
        await tx.query<{ n: string }>(
          "SELECT COALESCE(sum(amount),0) n FROM payments WHERE booking_id=$1 AND kind='PAYMENT'",
          [b.id],
        )
      ).rows[0].n,
    );
    if (approved && paid + p.amount > b.total)
      throw new AppError('This payment would exceed the booking total.');
    await tx.query(
      'UPDATE payment_submissions SET status=$1,reviewed_by=$2,reviewed_at=now(),review_note=$3 WHERE id=$4',
      [approved ? 'VERIFIED' : 'REJECTED', user.id, note, id],
    );
    if (approved)
      await tx.query(
        "INSERT INTO payments(booking_id,submission_id,amount,kind,reference,recorded_by) VALUES($1,$2,$3,'PAYMENT',$4,$5)",
        [b.id, p.id, p.amount, p.reference, user.id],
      );
    const received = paid + (approved ? p.amount : 0);
    const status =
      b.status === 'REFUND_PENDING'
        ? 'REFUND_PENDING'
        : received >= b.deposit_due
          ? 'CONFIRMED'
          : 'PENDING_PAYMENT';
    await tx.query(
      'UPDATE bookings SET status=$1,expires_at=CASE WHEN $2>0 THEN null ELSE now()+INTERVAL 48 HOUR END,updated_at=now() WHERE id=$3',
      [status, received, b.id],
    );
    await audit(tx, user, approved ? 'PAYMENT_VERIFIED' : 'PAYMENT_REJECTED', 'payment', p.id, {
      reference: b.reference,
      amount: p.amount,
      note,
    });
    await notify(
      tx,
      b.user_id,
      b.id,
      approved ? 'Payment verified' : 'Payment needs attention',
      `${b.reference}: ${approved ? 'staff verified your payment.' : 'your payment reference was rejected.'} ${status === 'CONFIRMED' ? 'Your reservation is confirmed.' : status === 'REFUND_PENDING' ? 'Your cancellation remains under review.' : 'The required deposit is still outstanding.'} ${note}`,
    );
  });
}
export async function cancelBooking(
  db: DB,
  reference: string,
  reason: string,
  user: User | null,
  accessToken?: string,
) {
  if (reason.trim().length < 5 || reason.length > 1000)
    throw new AppError('Please explain the cancellation request in 5–1,000 characters.');
  return db.transaction(async (tx) => {
    const b = await authorizedBooking(tx, reference, user, accessToken, true);
    if (['COMPLETED', 'CANCELLED', 'REFUNDED', 'REFUND_PENDING'].includes(b.status))
      throw new AppError('A cancellation cannot be requested for this status.');
    const underReview =
      (
        await tx.query(
          "SELECT id FROM payment_submissions WHERE booking_id=$1 AND status='UNDER_REVIEW'",
          [b.id],
        )
      ).rows.length > 0;
    const needsReview = b.paid > 0 || underReview;
    if (!needsReview && !b.seats_released)
      await tx.query('UPDATE departures SET reserved=reserved-$1 WHERE id=$2', [
        b.adults + b.children,
        b.departure_id,
      ]);
    await tx.query(
      'UPDATE bookings SET status=$1,cancellation_reason=$2,seats_released=$3,expires_at=null,updated_at=now() WHERE id=$4',
      [
        needsReview ? 'REFUND_PENDING' : 'CANCELLED',
        reason,
        needsReview ? b.seats_released : true,
        b.id,
      ],
    );
    if (user && user.role !== 'CUSTOMER')
      await audit(tx, user, 'CANCELLATION_REQUEST', 'booking', b.id, { reason });
    await notify(
      tx,
      b.user_id,
      b.id,
      needsReview ? 'Cancellation under review' : 'Reservation cancelled',
      `${reference}: ${needsReview ? 'staff will review the payment and any refund due.' : 'your seats have been released.'}`,
    );
  });
}
export async function transitionBooking(
  db: DB,
  reference: string,
  status: string,
  refundReference: string,
  user: User | null,
) {
  staff(user);
  return db.transaction(async (tx) => {
    const b = await authorizedBooking(tx, reference, user, undefined, true);
    if (status === 'CONFIRMED') {
      if (!['PENDING_REVIEW', 'PENDING_PAYMENT'].includes(b.status) || b.paid < b.deposit_due)
        throw new AppError('Confirmation requires a verified deposit and a pending reservation.');
    } else if (status === 'COMPLETED') {
      if (
        b.status !== 'CONFIRMED' ||
        b.paid < b.total ||
        new Date(b.snapshot.departure_at).getTime() + b.snapshot.duration * 86400000 > Date.now()
      )
        throw new AppError('Only fully paid, confirmed trips that have ended can be completed.');
    } else if (status === 'REFUNDED') {
      if (b.status !== 'REFUND_PENDING' || b.paid <= 0 || refundReference.trim().length < 4)
        throw new AppError(
          'A paid cancellation and the actual offline refund reference are required.',
        );
      if (
        (
          await tx.query(
            "SELECT id FROM payment_submissions WHERE booking_id=$1 AND status='UNDER_REVIEW'",
            [b.id],
          )
        ).rows.length
      )
        throw new AppError('Resolve pending payment submissions first.');
      await tx.query(
        "INSERT INTO payments(booking_id,amount,kind,reference,recorded_by) VALUES($1,$2,'REFUND',$3,$4)",
        [b.id, b.paid, refundReference, user.id],
      );
    } else if (status === 'CANCELLED') {
      if (b.status !== 'REFUND_PENDING' || b.paid > 0)
        throw new AppError(
          'Only an unpaid cancellation under review may be closed without a refund.',
        );
      if (
        (
          await tx.query(
            "SELECT id FROM payment_submissions WHERE booking_id=$1 AND status='UNDER_REVIEW'",
            [b.id],
          )
        ).rows.length
      )
        throw new AppError('Resolve pending submissions before cancellation.');
    } else throw new AppError('This status transition is not supported.');
    if (['REFUNDED', 'CANCELLED'].includes(status) && !b.seats_released)
      await tx.query('UPDATE departures SET reserved=reserved-$1 WHERE id=$2', [
        b.adults + b.children,
        b.departure_id,
      ]);
    await tx.query(
      'UPDATE bookings SET status=$1,seats_released=CASE WHEN $2 THEN true ELSE seats_released END,expires_at=null,updated_at=now() WHERE id=$3',
      [status, ['REFUNDED', 'CANCELLED'].includes(status), b.id],
    );
    await audit(tx, user, 'BOOKING_STATUS_CHANGED', 'booking', b.id, {
      from: b.status,
      to: status,
      refundReference,
    });
    await notify(
      tx,
      b.user_id,
      b.id,
      'Reservation updated',
      `${reference}: your reservation status is now ${status.toLowerCase().replaceAll('_', ' ')}.`,
    );
  });
}
