'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { date, dayKey } from '@/lib/format';
import type { Departure, Tour } from '@/lib/types';
export default function Calendar({
  departures,
  tours,
}: {
  departures: Departure[];
  tours: Tour[];
}) {
  const now = new Date();
  const manilaToday = new Date(dayKey(now) + 'T00:00:00');
  const [month, setMonth] = useState(
    new Date(manilaToday.getFullYear(), manilaToday.getMonth(), 1),
  );
  const [pkg, setPkg] = useState('');
  const [day, setDay] = useState('');
  const key = (n: number) =>
    `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
  const filtered = departures.filter(
    (d) =>
      (!pkg || d.package_id === pkg) && dayKey(d.departure_at).slice(0, 7) === key(1).slice(0, 7),
  );
  const listing = filtered.filter((d) => !day || dayKey(d.departure_at) === day);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const blank = month.getDay();
  return (
    <>
      <div className="notice">
        Departures marked as demonstration data are for testing. Availability comes from this
        application’s seat inventory.
      </div>
      <div className="calendar-toolbar">
        <div>
          <button
            className="icon-btn"
            aria-label="Previous month"
            onClick={() => {
              setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
              setDay('');
            }}
          >
            <ChevronLeft size={19} />
          </button>
          <h2>{month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</h2>
          <button
            className="icon-btn"
            aria-label="Next month"
            onClick={() => {
              setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
              setDay('');
            }}
          >
            <ChevronRight size={19} />
          </button>
        </div>
        <select
          className="control"
          style={{ width: 'auto' }}
          aria-label="Filter calendar by package"
          value={pkg}
          onChange={(e) => setPkg(e.target.value)}
        >
          <option value="">All experiences</option>
          {tours.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      <div className="calendar-grid">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div className="calendar-weekday" key={d}>
            {d}
          </div>
        ))}
        {Array.from({ length: blank }, (_, i) => (
          <div key={'blank' + i} className="calendar-day empty" />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const n = i + 1;
          const trips = filtered.filter((d) => dayKey(d.departure_at) === key(n));
          return (
            <button
              key={n}
              className={`calendar-day ${trips.length ? 'has-trips' : ''} ${day === key(n) ? 'selected' : ''}`}
              disabled={!trips.length}
              aria-label={`${date(key(n))}, ${trips.length} departures`}
              onClick={() => setDay(day === key(n) ? '' : key(n))}
            >
              <strong>{n}</strong>
              {trips.length > 0 && <small>{trips.length} trips</small>}
            </button>
          );
        })}
      </div>
      <div className="departure-list">
        {day && (
          <button className="link-button" onClick={() => setDay('')}>
            Show entire month
          </button>
        )}
        {listing.length ? (
          listing.map((d) => (
            <div className="departure-item" key={d.id}>
              <div>
                <h3>{d.title}</h3>
                <p>
                  {date(d.departure_at, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}{' '}
                  PHT ·{' '}
                  {d.available && new Date(d.booking_deadline) > now
                    ? `${d.capacity - d.reserved} seats available`
                    : 'Booking closed'}
                </p>
              </div>
              <Link className="btn secondary small" href={`/packages/${d.slug}`}>
                View experience
              </Link>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <CalendarDays size={30} />
            <h3>No departures this month</h3>
            <p>Try another month or request a custom trip with our team.</p>
            <Link className="btn primary" href="/custom-tour">
              Plan a custom trip
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
