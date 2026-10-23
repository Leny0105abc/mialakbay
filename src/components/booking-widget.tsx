'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
import { money, date } from '@/lib/format';
import { Field } from './ui';
import type { Tour, Departure } from '@/lib/types';
export default function BookingWidget({
  tour,
  departures,
}: {
  tour: Tour;
  departures: Departure[];
}) {
  const available = departures.filter(
    (d) => d.available && new Date(d.booking_deadline) > new Date() && d.reserved < d.capacity,
  );
  const [dep, setDep] = useState(available[0]?.id || '');
  const [adults, setAdults] = useState('1');
  const [children, setChildren] = useState('0');
  const selected = available.find((d) => d.id === dep);
  return (
    <aside className="booking-widget panel">
      <small>{tour.demo ? 'Sample package price from' : 'Your adventure from'}</small>
      <h2 className="price-heading">
        {money(tour.adult_price + (selected?.price_adjustment || 0))}
        <small> / adult</small>
      </h2>
      <small>
        Child from {money(tour.child_price + (selected?.price_adjustment || 0))} · {tour.duration}{' '}
        days, {tour.duration - 1} nights
      </small>
      <form action="/checkout" className="form-stack">
        <input type="hidden" name="package" value={tour.slug} />
        <Field label="Choose a departure">
          <select required name="departure" value={dep} onChange={(e) => setDep(e.target.value)}>
            <option value="" disabled>
              Select a date
            </option>
            {available.map((d) => (
              <option value={d.id} key={d.id}>
                {date(d.departure_at)} · {d.capacity - d.reserved} seats
              </option>
            ))}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Adults">
            <input
              type="number"
              name="adults"
              min="1"
              max={tour.max_participants}
              value={adults}
              onChange={(e) => setAdults(e.target.value)}
            />
          </Field>
          <Field label="Children">
            <input
              type="number"
              name="children"
              min="0"
              max={tour.max_participants - 1}
              value={children}
              onChange={(e) => setChildren(e.target.value)}
            />
          </Field>
        </div>
        {selected && (
          <small className="muted">
            Book by {date(selected.booking_deadline)} · {tour.min_participants}–
            {tour.max_participants} travelers per booking
          </small>
        )}
        <button
          className="btn primary"
          disabled={
            !selected || Number(adults) + Number(children) > selected.capacity - selected.reserved
          }
        >
          Reserve this experience <ArrowUpRight size={18} />
        </button>
      </form>
      <p className="mini-note">
        <ShieldCheck size={13} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
        {tour.deposit_percent}% verified deposit required to confirm.
        <br />
        No automatic payment or confirmation.
      </p>
      <Link
        href={`/custom-tour?destination=${encodeURIComponent(tour.destination)}`}
        className="btn secondary"
      >
        Ask us about this trip
      </Link>
    </aside>
  );
}
