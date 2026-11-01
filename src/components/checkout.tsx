'use client';
import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ArrowLeft, ShieldCheck, CalendarDays } from 'lucide-react';
import { api, Field, Message, Submit, useAction } from './ui';
import type { Tour, Departure, User, Settings } from '@/lib/types';
import { money, date } from '@/lib/format';
type Quote = {
  subtotal: number;
  discount: number;
  total: number;
  deposit_due: number;
  adult_price: number;
  child_price: number;
};
export default function Checkout({
  tour,
  departures,
  user,
  settings,
  initialDeparture,
  initialAdults,
  initialChildren,
}: {
  tour: Tour;
  departures: Departure[];
  user: User | null;
  settings: Settings;
  initialDeparture: string;
  initialAdults: number;
  initialChildren: number;
}) {
  const state = useAction();
  const [step, setStep] = useState(1);
  const [departure, setDeparture] = useState(initialDeparture);
  const [adults, setAdults] = useState(initialAdults);
  const [children, setChildren] = useState(initialChildren);
  const [code, setCode] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [method, setMethod] = useState('GCASH');
  const [contact, setContact] = useState({
    contact_name: user?.name || '',
    contact_email: user?.email || '',
    contact_phone: user?.phone || '',
  });
  const [names, setNames] = useState<string[]>([]);
  const [created, setCreated] = useState<{ reference: string; access_token: string } | null>(null);
  const selected = departures.find((d) => d.id === departure);
  const quoteInput = { departure_id: departure, adults, children, code };
  if (created)
    return (
      <div className="container page-content narrow">
        <div className="panel" style={{ textAlign: 'center', padding: '42px 25px' }}>
          <CheckCircle2 size={42} color="var(--teal)" style={{ margin: '0 auto 20px' }} />
          <span className="eyebrow">THE START OF SOMETHING GOOD</span>
          <h1 style={{ fontSize: 35 }}>Your reservation is in.</h1>
          <p>
            Reference <strong style={{ color: 'var(--teal)' }}>{created.reference}</strong>
          </p>
          <p>
            Your seats are reserved pending payment. Staff must verify your deposit before your trip
            is confirmed.
          </p>
          {!user && (
            <div className="access-key" style={{ textAlign: 'left' }}>
              <strong>Save your private guest access key</strong>
              <p style={{ fontSize: 11, marginTop: 8 }}>
                Use this key, your reference, and email to find this reservation on another device.
                This key is shown only here. Anyone with it can access your reservation.
              </p>
              <code>{created.access_token}</code>
              <small>Your browser also keeps a secure access cookie for 30 days.</small>
            </div>
          )}
          <Link className="btn primary" href={`/bookings/${created.reference}`}>
            View reservation & payment instructions
          </Link>
          <p className="mini-note">
            A reservation record was created. Email is sent only when a configured provider confirms
            delivery.
          </p>
        </div>
      </div>
    );
  return (
    <div className="container page-content">
      <div className="stepper">
        <span className="current">
          <b>1</b>Your travelers
        </span>
        <i />
        <span className={step === 2 ? 'current' : ''}>
          <b>2</b>Review & reserve
        </span>
        <i />
        <span>
          <b>3</b>Confirmation
        </span>
      </div>
      {tour.demo && (
        <div className="notice">
          This is a sample trip. Use test details and test payment references. Do not transfer real
          money to test this installation.
        </div>
      )}
      <div className="checkout-layout">
        <div className="checkout-main">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (step === 1) {
                state.run(async () => {
                  const q = await api<Quote>('quote', quoteInput);
                  setQuote(q);
                  setStep(2);
                }, 'Pricing checked against current availability.');
              } else
                state.run(async () => {
                  const result = await api<{ reference: string; access_token: string }>(
                    'bookings',
                    {
                      ...quoteInput,
                      ...contact,
                      payment_method: method,
                      travelers: Array.from({ length: adults + children }, (_, i) => ({
                        name: names[i] || '',
                        type: i < adults ? 'ADULT' : 'CHILD',
                      })),
                      accepted_terms: true,
                    },
                  );
                  setCreated(result);
                }, 'Reservation created.');
            }}
          >
            {step === 1 ? (
              <>
                <div className="panel">
                  <h2>Let’s get the details right.</h2>
                  <p>Choose your departure and the people coming along.</p>
                  <div className="form-grid">
                    <Field label="Departure date">
                      <select
                        required
                        value={departure}
                        onChange={(e) => {
                          setDeparture(e.target.value);
                          setQuote(null);
                        }}
                      >
                        <option value="">Choose a date</option>
                        {departures
                          .filter((d) => d.available && new Date(d.booking_deadline) > new Date())
                          .map((d) => (
                            <option value={d.id} key={d.id}>
                              {date(d.departure_at)} · {d.capacity - d.reserved} seats
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Adults">
                      <input
                        type="number"
                        min="1"
                        max={tour.max_participants}
                        value={adults}
                        onChange={(e) => {
                          setAdults(Math.min(100, Math.max(1, Number(e.target.value))));
                          setQuote(null);
                        }}
                        required
                      />
                    </Field>
                    <Field label="Children">
                      <input
                        type="number"
                        min="0"
                        max={tour.max_participants - 1}
                        value={children}
                        onChange={(e) => {
                          setChildren(Math.min(100, Math.max(0, Number(e.target.value))));
                          setQuote(null);
                        }}
                        required
                      />
                    </Field>
                    <Field label="Discount code (optional)">
                      <input
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value.toUpperCase());
                          setQuote(null);
                        }}
                        placeholder="e.g. LAKBAY10"
                        maxLength={40}
                      />
                    </Field>
                  </div>
                </div>
                <div className="panel">
                  <h2>Who’s leading the adventure?</h2>
                  <p>We’ll use these details to coordinate your trip.</p>
                  <div className="form-grid">
                    <Field label="Lead traveler’s name">
                      <input
                        value={contact.contact_name}
                        onChange={(e) => setContact({ ...contact, contact_name: e.target.value })}
                        required
                        minLength={2}
                        maxLength={120}
                        autoComplete="name"
                      />
                    </Field>
                    <Field label="Email address">
                      <input
                        type="email"
                        value={contact.contact_email}
                        readOnly={!!user}
                        onChange={(e) => setContact({ ...contact, contact_email: e.target.value })}
                        required
                        autoComplete="email"
                      />
                    </Field>
                    <Field label="Mobile number">
                      <input
                        type="tel"
                        value={contact.contact_phone}
                        onChange={(e) => setContact({ ...contact, contact_phone: e.target.value })}
                        required
                        minLength={7}
                        maxLength={30}
                        autoComplete="tel"
                      />
                    </Field>
                  </div>
                  {!user && (
                    <p className="mini-note">
                      Booking as a guest. Save your private access key after submission, or{' '}
                      <Link
                        href={`/login?next=${encodeURIComponent('/checkout?package=' + tour.slug + '&departure=' + departure)}`}
                        style={{ textDecoration: 'underline' }}
                      >
                        sign in first
                      </Link>
                      .
                    </p>
                  )}
                </div>
                <div className="panel">
                  <h2>Your fellow travelers</h2>
                  <p>Enter each traveler’s full name. Children use the configured child price.</p>
                  {Array.from({ length: adults + children }, (_, i) => (
                    <label className="traveler-row" key={i}>
                      <span>{i < adults ? `Adult ${i + 1}` : `Child ${i - adults + 1}`}</span>
                      <input
                        className="control"
                        value={names[i] || ''}
                        placeholder="Full name"
                        required
                        minLength={2}
                        maxLength={120}
                        onChange={(e) => {
                          const copy = [...names];
                          copy[i] = e.target.value;
                          setNames(copy);
                        }}
                      />
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="panel">
                  <h2>One last look before we go.</h2>
                  <div className="detail-grid">
                    <div>
                      <small>Lead traveler</small>
                      {contact.contact_name}
                    </div>
                    <div>
                      <small>Contact</small>
                      {contact.contact_email}
                      <br />
                      {contact.contact_phone}
                    </div>
                    <div>
                      <small>Departure</small>
                      {selected && date(selected.departure_at)}
                    </div>
                    <div>
                      <small>Travelers</small>
                      {names.slice(0, adults + children).join(', ')}
                    </div>
                  </div>
                  <hr className="separator" />
                  <h3>Your itinerary</h3>
                  {tour.inclusions.map((s) => (
                    <p style={{ fontSize: 12, marginBottom: 5 }} key={s}>
                      ✓ {s}
                    </p>
                  ))}
                  <p className="mini-note" style={{ textAlign: 'left' }}>
                    A copy of your full itinerary and booking policy is saved with your reservation.
                  </p>
                </div>
                <div className="panel">
                  <h2>How would you like to pay?</h2>
                  <p>Choose a manual payment method. No money is collected by this form.</p>
                  <div className="payment-options">
                    {[
                      ['GCASH', 'GCash'],
                      ['MAYA', 'Maya'],
                      ['BANK', 'Bank transfer'],
                      ['CASH', 'Pay at office'],
                    ].map(([key, title]) => (
                      <label className="payment-option" key={key}>
                        <input
                          type="radio"
                          name="method"
                          checked={method === key}
                          onChange={() => setMethod(key)}
                        />
                        {title}
                      </label>
                    ))}
                  </div>
                  <div className="payment-instructions">
                    {settings.payment_instructions[method]}
                  </div>
                  <p className="mini-note" style={{ textAlign: 'left' }}>
                    Online card payments are unavailable. After reserving, submit your payment
                    reference for staff verification. A screenshot or reference does not confirm
                    receipt.
                  </p>
                </div>
                <div className="panel">
                  <h3>Before you reserve</h3>
                  <p style={{ fontSize: 12, whiteSpace: 'pre-line' }}>{tour.policies}</p>
                  <label className="checkbox">
                    <input type="checkbox" required />
                    <span>
                      I have reviewed the itinerary,{' '}
                      <Link href="/terms" target="_blank">
                        booking terms
                      </Link>
                      ,{' '}
                      <Link href="/cancellation" target="_blank">
                        cancellation policy
                      </Link>
                      , and{' '}
                      <Link href="/privacy" target="_blank">
                        privacy notice
                      </Link>
                      , and agree to reserve this trip.
                    </span>
                  </label>
                </div>
              </>
            )}
            <Message error={state.error} />
            <div className="form-actions">
              {step === 2 ? (
                <button type="button" className="btn secondary" onClick={() => setStep(1)}>
                  <ArrowLeft size={15} />
                  Edit details
                </button>
              ) : (
                <Link className="text-link" href={`/packages/${tour.slug}`}>
                  <ArrowLeft size={15} />
                  Back to experience
                </Link>
              )}
              <Submit busy={state.busy}>
                {step === 1 ? 'Review my reservation' : 'Create my reservation'}
              </Submit>
            </div>
          </form>
        </div>
        <aside className="panel checkout-summary" style={{ position: 'sticky', top: 105 }}>
          <img className="summary-photo" src={tour.image_url} alt={tour.destination} />
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <h3 className="summary-title">{tour.title}</h3>
          <p style={{ fontSize: 11, marginBottom: 10 }}>
            <CalendarDays size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
            {selected ? date(selected.departure_at) : 'Choose a departure'} · {tour.duration} days
          </p>
          <div className="summary-lines">
            <div>
              <span>
                {adults} adult{adults !== 1 ? 's' : ''}
              </span>
              <span>{money((tour.adult_price + (selected?.price_adjustment || 0)) * adults)}</span>
            </div>
            {children > 0 && (
              <div>
                <span>{children} child travelers</span>
                <span>
                  {money((tour.child_price + (selected?.price_adjustment || 0)) * children)}
                </span>
              </div>
            )}
            {quote && (
              <>
                <div>
                  <span>Discount</span>
                  <span>−{money(quote.discount)}</span>
                </div>
                <div className="summary-total">
                  <span>Total</span>
                  <strong>{money(quote.total)}</strong>
                </div>
                <div>
                  <span>{tour.deposit_percent}% deposit required</span>
                  <strong>{money(quote.deposit_due)}</strong>
                </div>
              </>
            )}
            {!quote && (
              <small className="muted">
                Final pricing and promotion eligibility are calculated when you review your
                reservation.
              </small>
            )}
          </div>
          <p className="mini-note">
            <ShieldCheck size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Seats
            are checked again when you reserve. The unpaid hold expires after 48 hours.
          </p>
        </aside>
      </div>
    </div>
  );
}
