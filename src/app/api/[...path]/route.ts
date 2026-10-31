import { NextRequest, NextResponse, after } from 'next/server';
import { cookies } from 'next/headers';
import { z, ZodError } from 'zod';
import { getDB } from '@/lib/db';
import { currentUser, COOKIE, cookieOptions } from '@/lib/auth';
import {
  AppError,
  hashPassword,
  checkPassword,
  token,
  hashToken,
  rateLimit,
  staff,
  signedIn,
  audit,
  readJSON,
} from '@/lib/security';
import {
  authorizedBooking,
  createBooking,
  quote,
  submitPayment,
  reviewPayment,
  cancelBooking,
  transitionBooking,
  expireHolds,
  notify,
} from '@/lib/booking';
import {
  tours,
  departures,
  itinerary,
  settings,
  queryInquiries,
  queryPromotions,
} from '@/lib/data';
import { adminSave, savePackage } from '@/lib/admin';
import { reports, csv } from '@/lib/reports';
import { deliverEmails } from '@/lib/email';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { User, Booking } from '@/lib/types';
import { date } from '@/lib/format';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
const ok = (data: unknown = { success: true }) =>
  NextResponse.json(data, { headers: { 'Cache-Control': 'private, no-store' } });
async function handle(req: NextRequest, context: Context) {
  try {
    const parts = (await context.params).path;
    const [root, section, id, action] = parts;
    const db = await getDB();
    const user = await currentUser();
    const jar = await cookies();
    if (req.method !== 'GET') {
      const origin = req.headers.get('origin');
      const expected = new URL(process.env.APP_URL || req.url).origin;
      if (!origin || origin !== expected)
        throw new AppError(
          'This request could not be verified. Reload the page and try again.',
          403,
        );
      if (Number(req.headers.get('content-length') || 0) > 200000)
        throw new AppError('This request is too large.', 413);
      await rateLimit(
        db,
        `write:${user?.id || hashToken(req.headers.get('x-forwarded-for') || 'local')}`,
        120,
        60,
      );
    }
    if (req.method === 'GET') {
      if (root === 'me') return ok({ user });
      if (root === 'settings') return ok(await settings(db));
      if (root === 'departures') {
        await expireHolds(db);
        return ok(await departures(req.nextUrl.searchParams.get('package') || undefined, db));
      }
      if (root === 'packages') {
        if (section === 'itinerary')
          return ok(await itinerary(req.nextUrl.searchParams.get('package') || '', db));
        return ok(await tours(false, db));
      }
      if (root === 'bookings') {
        if (!section) {
          signedIn(user);
          return ok(
            (
              await db.query<Booking>(
                "SELECT b.*,COALESCE((SELECT sum(CASE WHEN kind='PAYMENT' THEN amount ELSE -amount END) FROM payments WHERE booking_id=b.id),0) paid FROM bookings b WHERE user_id=$1 ORDER BY created_at DESC",
                [user.id],
              )
            ).rows,
          );
        }
        const b = await authorizedBooking(
          db,
          section,
          user,
          jar.get(`lakbay_guest_${section}`)?.value,
        );
        if (id === 'voucher') {
          if (!['CONFIRMED', 'COMPLETED'].includes(b.status))
            throw new AppError('Vouchers are available after staff verifies the required payment.');
          const pdf = await PDFDocument.create();
          let page = pdf.addPage([595, 842]);
          const font = await pdf.embedFont(StandardFonts.Helvetica);
          const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
          let y = 790;
          const line = (value: string, size = 11, heading = false) => {
            const safe = value.replace(/[^\x20-\x7E]/g, ' ');
            const words = safe.split(' ');
            let text = '';
            const lines: string[] = [];
            for (const word of words) {
              if (font.widthOfTextAtSize(text + word, size) > 490) {
                lines.push(text);
                text = '';
              }
              text += word + ' ';
            }
            lines.push(text);
            for (const l of lines) {
              if (y < 60) {
                page = pdf.addPage([595, 842]);
                y = 790;
              }
              page.drawText(l, {
                x: 50,
                y,
                size,
                font: heading ? bold : font,
                color: rgb(0.06, 0.18, 0.2),
              });
              y -= size + 9;
            }
          };
          line((await settings(db)).brand + ' Travel & Tours', 22, true);
          line('BOOKING CONFIRMATION', 14, true);
          line(b.reference, 16, true);
          line(b.snapshot.title, 18, true);
          line(
            `${date(b.snapshot.departure_at)} | ${b.snapshot.duration} days | ${b.adults + b.children} travelers`,
          );
          line(`Lead traveler: ${b.contact_name}`);
          line(`Meeting point: ${b.snapshot.meeting_point}`);
          line(
            `Total: PHP ${(b.total / 100).toFixed(2)} | Verified paid: PHP ${(b.paid / 100).toFixed(2)} | Balance: PHP ${((b.total - b.paid) / 100).toFixed(2)}`,
          );
          line('ITINERARY', 13, true);
          for (const d of b.snapshot.itinerary) {
            line(`Day ${d.day}: ${d.title}`, 12, true);
            for (const a of d.activities)
              line(
                `${a.time_label} ${a.title}: ${a.description}${a.included ? '' : ' (Optional; excluded)'}`,
              );
          }
          line('BOOKING POLICY', 12, true);
          line(b.snapshot.policies);
          line(
            'This voucher reflects recorded application data. Demo itineraries are for testing.',
          );
          return new NextResponse(Buffer.from(await pdf.save()), {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="${b.reference}.pdf"`,
              'Cache-Control': 'private, no-store',
            },
          });
        }
        const travelers = (
          await db.query('SELECT name,type FROM booking_travelers WHERE booking_id=$1', [b.id])
        ).rows;
        const submissions = (
          await db.query(
            'SELECT id,amount,method,reference,status,review_note,created_at FROM payment_submissions WHERE booking_id=$1 ORDER BY created_at DESC',
            [b.id],
          )
        ).rows;
        const payments = (
          await db.query(
            'SELECT amount,kind,reference,paid_at FROM payments WHERE booking_id=$1 ORDER BY paid_at',
            [b.id],
          )
        ).rows;
        const { guest_token_hash: _, ...safe } = b;
        void _;
        return ok({
          booking: safe,
          travelers,
          submissions,
          payments,
          settings: await settings(db),
        });
      }
      if (root === 'notifications') {
        signedIn(user);
        return ok(
          (
            await db.query(
              'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC',
              [user.id],
            )
          ).rows,
        );
      }
      if (root === 'inquiries') {
        signedIn(user);
        return ok((await queryInquiries(db, user.id)).rows);
      }
      if (root === 'admin') {
        staff(user);
        if (section === 'dashboard' || section === 'reports')
          return ok({
            ...(await reports(db)),
            recent: (
              await db.query(
                'SELECT reference,contact_name,status,total,created_at FROM bookings ORDER BY created_at DESC LIMIT 6',
              )
            ).rows,
            inquiries: (
              await db.query(
                'SELECT id,name,destination,status,created_at FROM custom_inquiries ORDER BY created_at DESC LIMIT 5',
              )
            ).rows,
          });
        if (section === 'export') {
          const rows = (
            await db.query(
              `SELECT reference,contact_name,contact_email,status,adults,children,round(total/100.0,2) AS total_php,round(COALESCE((SELECT sum(CASE WHEN kind='PAYMENT' THEN amount ELSE -amount END) FROM payments WHERE booking_id=b.id),0)/100.0,2) verified_paid_php,JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.title')) package,JSON_UNQUOTE(JSON_EXTRACT(snapshot,'$.departure_at')) departure,created_at FROM bookings b ORDER BY created_at DESC`,
            )
          ).rows;
          await audit(db, user, 'CSV_EXPORTED', 'report', 'bookings');
          return new NextResponse(csv(rows), {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': 'attachment; filename="lakbay-reservations.csv"',
              'Cache-Control': 'private, no-store',
            },
          });
        }
        if (section === 'packages')
          return ok({
            items: await tours(true, db),
            destinations: (await db.query('SELECT * FROM destinations ORDER BY name')).rows,
            images: (await db.query('SELECT * FROM package_images ORDER BY position')).rows,
          });
        if (section === 'destinations')
          return ok({ items: (await db.query('SELECT * FROM destinations ORDER BY name')).rows });
        if (section === 'itineraries') return ok({ items: await tours(true, db) });
        if (section === 'departures')
          return ok({
            items: (
              await db.query(
                'SELECT s.*,p.title FROM departures s JOIN packages p ON p.id=s.package_id ORDER BY departure_at',
              )
            ).rows,
            packages: await tours(true, db),
          });
        if (section === 'reservations')
          return ok({
            items: (
              await db.query(
                "SELECT b.id,b.reference,b.contact_name,b.contact_email,b.status,b.total,b.adults,b.children,b.created_at,b.snapshot,COALESCE((SELECT sum(CASE WHEN kind='PAYMENT' THEN amount ELSE -amount END) FROM payments WHERE booking_id=b.id),0) paid FROM bookings b ORDER BY created_at DESC",
              )
            ).rows,
          });
        if (section === 'payments')
          return ok({
            items: (
              await db.query(
                'SELECT s.*,b.reference booking_reference,b.contact_name,b.status booking_status FROM payment_submissions s JOIN bookings b ON b.id=s.booking_id ORDER BY s.created_at DESC',
              )
            ).rows,
          });
        if (section === 'customers')
          return ok({
            items: (
              await db.query(
                "SELECT u.id,u.name,u.email,u.created_at,p.phone,p.address,(SELECT count(*) FROM bookings b WHERE b.user_id=u.id) bookings FROM users u LEFT JOIN customer_profiles p ON p.user_id=u.id WHERE role='CUSTOMER' ORDER BY u.created_at DESC",
              )
            ).rows,
            bookings: (
              await db.query(
                'SELECT reference,user_id,status,total,snapshot FROM bookings WHERE user_id IS NOT NULL',
              )
            ).rows,
          });
        if (section === 'inquiries')
          return ok({
            items: (await queryInquiries(db)).rows,
          });
        if (section === 'promotions')
          return ok({
            items: (await queryPromotions(db)).rows,
            packages: await tours(true, db),
          });
        if (section === 'reviews')
          return ok({
            items: (
              await db.query(
                'SELECT r.*,u.name,p.title FROM reviews r JOIN users u ON u.id=r.user_id JOIN packages p ON p.id=r.package_id ORDER BY r.created_at DESC',
              )
            ).rows,
          });
        if (section === 'content')
          return ok({
            items: (await db.query('SELECT * FROM website_content ORDER BY `key`')).rows,
          });
        if (section === 'settings') {
          if (user.role !== 'SUPER_ADMIN')
            throw new AppError('Super administrator access required.', 403);
          return ok({
            settings: await settings(db),
            staff: (
              await db.query(
                "SELECT id,name,email,role FROM users WHERE role IN ('STAFF','SUPER_ADMIN')",
              )
            ).rows,
            emailConfigured: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
          });
        }
        if (section === 'audit')
          return ok({
            items: (
              await db.query(
                'SELECT a.*,u.name FROM audit_logs a JOIN users u ON u.id=a.actor_id ORDER BY created_at DESC LIMIT 500',
              )
            ).rows,
          });
      }
    } else {
      const body = await readJSON(req);
      after(async () => {
        try {
          await deliverEmails(db);
        } catch {
          console.error('Notification delivery deferred.');
        }
      });
      if (root === 'auth') {
        if (section === 'logout') {
          const value = jar.get(COOKIE)?.value;
          if (value) await db.query('DELETE FROM sessions WHERE token_hash=$1', [hashToken(value)]);
          jar.delete(COOKIE);
          for (const cookie of jar.getAll()) {
            if (cookie.name.startsWith('lakbay_guest_')) jar.delete(cookie.name);
          }
          return ok();
        }
        const schema = z.object({
          email: z
            .email()
            .max(254)
            .transform((v) => v.toLowerCase()),
          password: z
            .string()
            .min(section === 'register' ? 12 : 1)
            .max(128),
          name: z.string().trim().min(2).max(120).optional(),
        });
        const v = schema.parse(body);
        await rateLimit(db, `auth:${hashToken(v.email)}`, 10, 900);
        let account: User;
        if (section === 'register') {
          if (!v.name) throw new AppError('Please enter your name.');
          const exists = (await db.query('SELECT id FROM users WHERE email=$1', [v.email])).rows
            .length;
          if (exists)
            throw new AppError(
              'Unable to create this account. Try signing in or use another email.',
            );
          account = await db.transaction(async (tx) => {
            const u = (
              await tx.insertSQL<User>(
                'INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3)',
                [v.email, v.name, await hashPassword(v.password)],
              )
            ).rows[0];
            await tx.query('INSERT INTO customer_profiles(user_id) VALUES($1)', [u.id]);
            await notify(
              tx,
              u.id,
              null,
              'Welcome to Lakbay',
              'Your account is ready. Explore packages, manage reservations, and keep your travel plans in one place.',
            );
            return u;
          });
        } else if (section === 'login') {
          const found = (
            await db.query<User & { password_hash: string }>('SELECT * FROM users WHERE email=$1', [
              v.email,
            ])
          ).rows[0];
          const valid = await checkPassword(
            v.password,
            found?.password_hash || 'scrypt:placeholder:00',
          );
          if (!found || !valid) throw new AppError('The email or password is incorrect.', 401);
          account = found;
        } else throw new AppError('Unknown authentication action.', 404);
        const secret = token();
        await db.query(
          'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+INTERVAL 7 DAY)',
          [hashToken(secret), account.id],
        );
        jar.set(COOKIE, secret, { ...cookieOptions, maxAge: 604800 });
        return ok({
          user: { id: account.id, name: account.name, email: account.email, role: account.role },
        });
      }
      if (root === 'quote') {
        const q = await quote(db, body);
        return ok({
          subtotal: q.subtotal,
          discount: q.discount,
          total: q.total,
          deposit_due: q.deposit_due,
          adult_price: q.adult_price,
          child_price: q.child_price,
        });
      }
      if (root === 'bookings') {
        if (section === 'lookup') {
          const v = z
            .object({
              reference: z.string().max(60),
              email: z.email(),
              access_token: z.string().min(32).max(128),
            })
            .parse(body);
          await rateLimit(db, `lookup:${hashToken(v.reference)}`, 8, 900);
          const b = await authorizedBooking(db, v.reference, null, v.access_token);
          if (b.contact_email !== v.email.toLowerCase())
            throw new AppError('Reservation not found or access denied.', 404);
          jar.set(`lakbay_guest_${b.reference}`, v.access_token, {
            ...cookieOptions,
            maxAge: 2592000,
          });
          return ok({ reference: b.reference });
        }
        if (!section) {
          await rateLimit(
            db,
            `booking:${user?.id || hashToken(String(body.contact_email || 'guest'))}`,
            10,
            3600,
          );
          const result = await createBooking(db, body, user);
          if (!user)
            jar.set(`lakbay_guest_${result.booking.reference}`, result.accessToken, {
              ...cookieOptions,
              maxAge: 2592000,
            });
          return ok({
            reference: result.booking.reference,
            ...(!user ? { access_token: result.accessToken } : {}),
          });
        }
        const key = jar.get(`lakbay_guest_${section}`)?.value;
        if (id === 'payment') {
          await submitPayment(db, section, body, user, key);
          return ok();
        }
        if (id === 'cancel') {
          await cancelBooking(db, section, String(body.reason || ''), user, key);
          return ok();
        }
        if (id === 'review') {
          signedIn(user);
          const v = z
            .object({
              rating: z.coerce.number().int().min(1).max(5),
              body: z.string().trim().min(10).max(2000),
            })
            .parse(body);
          const b = await authorizedBooking(db, section, user);
          if (b.user_id !== user.id || b.status !== 'COMPLETED')
            throw new AppError('Only the customer on a completed booking can review it.', 403);
          const packageId = (
            await db.query<{ package_id: string }>(
              'SELECT package_id FROM departures WHERE id=$1',
              [b.departure_id],
            )
          ).rows[0].package_id;
          await db.query(
            'INSERT INTO reviews(booking_id,user_id,package_id,rating,body) VALUES($1,$2,$3,$4,$5)',
            [b.id, user.id, packageId, v.rating, v.body],
          );
          return ok();
        }
      }
      if (root === 'profile') {
        signedIn(user);
        const v = z
          .object({
            name: z.string().trim().min(2).max(120),
            phone: z.string().max(30),
            address: z.string().max(500),
          })
          .parse(body);
        await db.transaction(async (tx) => {
          await tx.query('UPDATE users SET name=$1 WHERE id=$2', [v.name, user.id]);
          await tx.query(
            'INSERT INTO customer_profiles(user_id,phone,address) VALUES($1,$2,$3) ON DUPLICATE KEY UPDATE phone=$2,address=$3',
            [user.id, v.phone, v.address],
          );
        });
        return ok();
      }
      if (root === 'notifications') {
        signedIn(user);
        await db.query('UPDATE notifications SET read_at=now() WHERE user_id=$1', [user.id]);
        return ok();
      }
      if (root === 'inquiries') {
        const v = z
          .object({
            name: z.string().trim().min(2).max(120),
            email: z.email().max(254),
            phone: z.string().min(7).max(30),
            destination: z.string().min(2).max(200),
            start_date: z.iso.date(),
            end_date: z.iso.date(),
            travelers: z.coerce.number().int().min(1).max(1000),
            budget: z.coerce.number().int().positive().max(1000000000),
            accommodation: z.string().min(2).max(200),
            interests: z.string().min(2).max(2000),
            requests: z.string().max(3000).default(''),
          })
          .parse(body);
        if (
          v.end_date < v.start_date ||
          v.start_date <
            new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
        )
          throw new AppError('Choose valid future travel dates.');
        await rateLimit(db, `inquiry:${hashToken(v.email)}`, 5, 3600);
        const row = (
          await db.insertSQL<{ id: string }>(
            'INSERT INTO custom_inquiries(user_id,name,email,phone,destination,start_date,end_date,travelers,budget,accommodation,interests,requests) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
            [
              user?.id || null,
              v.name,
              v.email,
              v.phone,
              v.destination,
              v.start_date,
              v.end_date,
              v.travelers,
              v.budget,
              v.accommodation,
              v.interests,
              v.requests,
            ],
          )
        ).rows[0];
        await notify(
          db,
          user?.id || null,
          null,
          'Travel inquiry received',
          `Your inquiry for ${v.destination} is awaiting agency review. Reference ${row.id.slice(0, 8).toUpperCase()}.`,
          v.email,
        );
        return ok({ reference: row.id.slice(0, 8).toUpperCase() });
      }
      if (root === 'admin') {
        staff(user);
        if (section === 'packages') return ok(await savePackage(db, body, user));
        if (section === 'payments') {
          const v = z
            .object({ approved: z.boolean(), note: z.string().min(3).max(1000) })
            .parse(body);
          await reviewPayment(db, id, v.approved, v.note, user);
          return ok();
        }
        if (section === 'reservations' && action === 'status') {
          const v = z
            .object({ status: z.string(), refund_reference: z.string().max(100).default('') })
            .parse(body);
          await transitionBooking(db, id, v.status, v.refund_reference, user);
          return ok();
        }
        return ok(await adminSave(db, section, body, user));
      }
    }
    throw new AppError('This endpoint was not found.', 404);
  } catch (error) {
    if (error instanceof AppError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          error: error.issues.map((i) => `${i.path.join('.') || 'Input'}: ${i.message}`).join('; '),
        },
        { status: 422 },
      );
    const code = (error as { code?: string }).code;
    if (code === 'ER_DUP_ENTRY')
      return NextResponse.json(
        { error: 'This record already exists. Check the unique name, code, reference, or email.' },
        { status: 409 },
      );
    if (code === 'ER_NO_REFERENCED_ROW_2' || code === 'ER_CHECK_CONSTRAINT_VIOLATED')
      return NextResponse.json(
        {
          error:
            'These values conflict with existing records. Check the selected package, limits, and dates.',
        },
        { status: 422 },
      );
    console.error(error instanceof Error ? error.message : 'Unexpected request failure');
    return NextResponse.json(
      { error: 'Something went wrong. Please try again or contact the agency.' },
      { status: 500 },
    );
  }
}
export { handle as GET, handle as POST };
