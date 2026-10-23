'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Printer, Download, ArrowLeft, LoaderCircle } from 'lucide-react';
import { api, Field, Message, Submit, useAction, formValues } from './ui';
import { Timeline } from './tours';
import { money, date, label } from '@/lib/format';
import type { Booking, PaymentSubmission, Settings, User } from '@/lib/types';
type Detail = {
  booking: Booking;
  travelers: { name: string; type: string }[];
  submissions: PaymentSubmission[];
  payments: { amount: number; kind: string; reference: string; paid_at: string }[];
  settings: Settings;
};
export default function BookingDetail({
  reference,
  user,
}: {
  reference: string;
  user: User | null;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState('');
  const state = useAction();
  const isStaff = !!user && user.role !== 'CUSTOMER';
  const load = useCallback(
    () =>
      api<Detail>(`bookings/${reference}`)
        .then(setData)
        .catch((e) => setLoadError(e.message)),
    [reference],
  );
  useEffect(() => {
    load();
  }, [load]);
  if (loadError)
    return (
      <div className="container page-content narrow">
        <Message error={loadError} />
        <Link href="/lookup" className="btn primary">
          Find a guest reservation
        </Link>
      </div>
    );
  if (!data)
    return (
      <div className="loading">
        <LoaderCircle className="spin" />
        Opening your reservation…
      </div>
    );
  const b = data.booking;
  return (
    <div className="container page-content">
      <Link
        className="text-link no-print"
        href={isStaff ? '/admin/reservations' : user ? '/account/bookings' : '/packages'}
      >
        <ArrowLeft size={14} />
        {isStaff ? 'All reservations' : user ? 'My bookings' : 'Explore experiences'}
      </Link>
      <div className="booking-header" style={{ marginTop: 25 }}>
        <div>
          <div className="booking-ref">{b.reference}</div>
          <h1>{b.snapshot.title}</h1>
          <span className={`badge ${b.status.toLowerCase()}`}>{label(b.status)}</span>
        </div>
        <div className="row-actions no-print">
          <button className="btn secondary" onClick={() => window.print()}>
            <Printer size={15} />
            Print itinerary
          </button>
          {['CONFIRMED', 'COMPLETED'].includes(b.status) && (
            <a className="btn primary" href={`/api/bookings/${b.reference}/voucher`}>
              <Download size={15} />
              Voucher PDF
            </a>
          )}
        </div>
      </div>
      <Message error={state.error} success={state.success} />
      <div className="checkout-layout">
        <div>
          <section className="panel">
            <h2>Your reservation</h2>
            <div className="detail-grid">
              <div>
                <small>Departure (Asia/Manila)</small>
                {date(b.snapshot.departure_at, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </div>
              <div>
                <small>Duration</small>
                {b.snapshot.duration} days / {b.snapshot.duration - 1} nights
              </div>
              <div>
                <small>Lead traveler</small>
                {b.contact_name}
                <br />
                {b.contact_email}
                <br />
                {b.contact_phone}
              </div>
              <div>
                <small>Travelers</small>
                {data.travelers.map((t, i) => (
                  <div key={i}>
                    {t.name} <small style={{ display: 'inline' }}>({t.type.toLowerCase()})</small>
                  </div>
                ))}
              </div>
              <div className="span-2">
                <small>Meeting point</small>
                {b.snapshot.meeting_point}
              </div>
            </div>
            {b.expires_at && !['CONFIRMED', 'COMPLETED', 'CANCELLED'].includes(b.status) && (
              <div className="notice" style={{ margin: '20px 0 0' }}>
                Unpaid hold until{' '}
                {date(b.expires_at, {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}{' '}
                PHT. Submissions under review await a staff decision.
              </div>
            )}
            {b.cancellation_reason && (
              <div className="notice" style={{ marginTop: 20 }}>
                Cancellation: {b.cancellation_reason}
              </div>
            )}
          </section>
          <section className="panel">
            <h2>Your itinerary, saved for you.</h2>
            <p style={{ fontSize: 11 }}>This is the original itinerary from your reservation.</p>
            <Timeline days={b.snapshot.itinerary} />
          </section>
          <section className="panel">
            <h2>Payment history</h2>
            {!data.submissions.length && !data.payments.length ? (
              <p style={{ fontSize: 12 }}>
                No payment submissions yet. Nothing has been recorded as received.
              </p>
            ) : (
              <>
                {data.submissions.map((p) => (
                  <div className="departure-item" key={p.id}>
                    <div>
                      <h3>
                        {money(p.amount)} · {label(p.method)}
                      </h3>
                      <p>
                        {p.reference} · {date(p.created_at)}
                      </p>
                      {p.review_note && <p>Staff note: {p.review_note}</p>}
                    </div>
                    <span className={`badge ${p.status.toLowerCase()}`}>{label(p.status)}</span>
                  </div>
                ))}
                {data.payments.map((p, i) => (
                  <p key={i} style={{ fontSize: 12 }}>
                    {p.kind === 'REFUND' ? 'Recorded offline refund' : 'Verified receipt'}:{' '}
                    {money(p.amount)} · {p.reference} · {date(p.paid_at)}
                  </p>
                ))}
              </>
            )}
          </section>
          <section className="panel">
            <h2>Booking policy</h2>
            <p style={{ fontSize: 12, whiteSpace: 'pre-line' }}>{b.snapshot.policies}</p>
          </section>
          {user?.id === b.user_id && b.status === 'COMPLETED' && (
            <section className="panel no-print">
              <h2>How was your adventure?</h2>
              <p style={{ fontSize: 12 }}>
                Reviews from completed bookings appear publicly only after moderation.
              </p>
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = formValues(e);
                  state.run(async () => {
                    await api(`bookings/${b.reference}/review`, v);
                  }, 'Your review was submitted for moderation.');
                }}
              >
                <Field label="Your rating">
                  <select name="rating">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option value={n} key={n}>
                        {n} stars
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Your experience">
                  <textarea name="body" required minLength={10} maxLength={2000} />
                </Field>
                <Submit busy={state.busy}>Submit review</Submit>
              </form>
            </section>
          )}
          {isStaff && (
            <section className="panel no-print">
              <h2>Agency actions</h2>
              <p style={{ fontSize: 12 }}>
                Only valid transitions are accepted. A completed trip must have ended and be fully
                paid. Refunds require the reference of an actual offline transfer.
              </p>
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = formValues(e);
                  state.run(async () => {
                    await api(`admin/reservations/${b.reference}/status`, v);
                    await load();
                  });
                }}
              >
                <Field label="Change reservation status">
                  <select name="status">
                    <option value="CONFIRMED">Confirm (verified deposit required)</option>
                    <option value="COMPLETED">Complete trip (ended and fully paid)</option>
                    <option value="REFUNDED">Record full offline refund</option>
                    <option value="CANCELLED">Close unpaid cancellation review</option>
                  </select>
                </Field>
                <Field label="Offline refund reference, if applicable">
                  <input name="refund_reference" minLength={4} maxLength={100} />
                </Field>
                <Submit busy={state.busy}>Apply status change</Submit>
              </form>
            </section>
          )}
        </div>
        <aside>
          <div className="panel">
            <span className="eyebrow">YOUR BOOKING SUMMARY</span>
            <div className="summary-lines">
              <div>
                <span>Original subtotal</span>
                <span>{money(b.subtotal)}</span>
              </div>
              <div>
                <span>Discount</span>
                <span>−{money(b.discount)}</span>
              </div>
              <div className="summary-total">
                <span>Total</span>
                <strong>{money(b.total)}</strong>
              </div>
              <div>
                <span>Verified net paid</span>
                <strong>{money(b.paid)}</strong>
              </div>
              <div>
                <span>Outstanding</span>
                <strong>{money(b.total - b.paid)}</strong>
              </div>
              <div>
                <span>Deposit required</span>
                <strong>{money(b.deposit_due)}</strong>
              </div>
            </div>
            <p className="booking-status-note">
              A submitted reference is reviewed by staff against actual receipts. Only verified
              receipts count toward your balance.
            </p>
          </div>
          {['PENDING_PAYMENT', 'PENDING_REVIEW', 'CONFIRMED'].includes(b.status) &&
            b.paid < b.total && (
              <section className="panel no-print">
                <h3>Submit payment details</h3>
                <form
                  className="form-stack"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const v = formValues(e);
                    state.run(async () => {
                      await api(`bookings/${b.reference}/payment`, {
                        ...v,
                        amount: Math.round(Number(v.amount) * 100),
                      });
                      await load();
                    }, 'Payment submitted for staff review.');
                  }}
                >
                  <Field label="Payment method">
                    <select
                      name="method"
                      defaultValue={b.payment_method}
                      onChange={(e) => {
                        const el = e.currentTarget
                          .closest('form')
                          ?.querySelector('[data-instructions]');
                        if (el) el.textContent = data.settings.payment_instructions[e.target.value];
                      }}
                    >
                      <option value="GCASH">GCash</option>
                      <option value="MAYA">Maya</option>
                      <option value="BANK">Bank transfer</option>
                      <option value="CASH">Cash / pay at office</option>
                    </select>
                  </Field>
                  <div className="payment-instructions" data-instructions>
                    {data.settings.payment_instructions[b.payment_method]}
                  </div>
                  <Field label="Amount paid (PHP)">
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={(b.total - b.paid) / 100}
                      defaultValue={
                        Math.max(0, b.deposit_due - b.paid) / 100 || (b.total - b.paid) / 100
                      }
                      required
                    />
                  </Field>
                  <Field label="Transaction / receipt reference">
                    <input name="reference" required minLength={4} maxLength={100} />
                  </Field>
                  <Submit busy={state.busy}>Submit for review</Submit>
                </form>
              </section>
            )}
          {isStaff && data.submissions.some((p) => p.status === 'UNDER_REVIEW') && (
            <section className="panel no-print">
              <h3>Verify actual receipt</h3>
              {data.submissions
                .filter((p) => p.status === 'UNDER_REVIEW')
                .map((p) => (
                  <form
                    className="form-stack"
                    key={p.id}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = formValues(e);
                      state.run(async () => {
                        await api(`admin/payments/${p.id}`, {
                          approved: v.decision === 'verify',
                          note: v.note,
                        });
                        await load();
                      });
                    }}
                  >
                    <p style={{ fontSize: 12 }}>
                      {money(p.amount)} · {p.reference}
                      <br />
                      Check your actual bank, wallet, or office ledger before approving.
                    </p>
                    <Field label="Decision">
                      <select name="decision">
                        <option value="verify">Verify receipt</option>
                        <option value="reject">Reject submission</option>
                      </select>
                    </Field>
                    <Field label="Review note">
                      <textarea name="note" minLength={3} maxLength={1000} required />
                    </Field>
                    <Submit busy={state.busy}>Record review</Submit>
                  </form>
                ))}
            </section>
          )}
          {!['CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'COMPLETED'].includes(b.status) && (
            <section className="panel no-print">
              <h3>Plans changed?</h3>
              <p style={{ fontSize: 11 }}>
                Paid reservations and pending payment submissions require staff review before
                cancellation is completed.
              </p>
              <form
                className="form-stack"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = formValues(e);
                  state.run(async () => {
                    await api(`bookings/${b.reference}/cancel`, v);
                    await load();
                  }, 'Your cancellation has been recorded.');
                }}
              >
                <Field label="Reason for cancellation">
                  <textarea name="reason" required minLength={5} maxLength={1000} />
                </Field>
                <Submit busy={state.busy}>Request cancellation</Submit>
              </form>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
