'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SlidersHorizontal, Search, RotateCcw } from 'lucide-react';
import { TourCard } from './tours';
import { Field } from './ui';
import { categories, dayKey } from '@/lib/format';
import type { Tour, Departure } from '@/lib/types';
export default function Explorer({
  tours,
  departures,
}: {
  tours: Tour[];
  departures: Departure[];
}) {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [category, setCategory] = useState(params.get('category') || '');
  const [budget, setBudget] = useState('');
  const [duration, setDuration] = useState('');
  const [date, setDate] = useState(params.get('date') || '');
  const [travelers, setTravelers] = useState(params.get('travelers') || '1');
  const [sort, setSort] = useState(params.get('sort') || 'featured');
  const [mobile, setMobile] = useState(false);
  const filtered = tours
    .filter(
      (p) =>
        `${p.title} ${p.destination} ${p.description}`.toLowerCase().includes(q.toLowerCase()) &&
        (!category || p.category === category) &&
        (!budget || p.adult_price <= Number(budget) * 100) &&
        (!duration || p.duration <= Number(duration)) &&
        departures.some(
          (d) =>
            d.package_id === p.id &&
            d.available &&
            new Date(d.booking_deadline) > new Date() &&
            d.capacity - d.reserved >= Number(travelers) &&
            (!date || dayKey(d.departure_at) === date),
        ),
    )
    .sort((a, b) =>
      sort === 'price-asc'
        ? a.adult_price - b.adult_price
        : sort === 'price-desc'
          ? b.adult_price - a.adult_price
          : sort === 'duration'
            ? a.duration - b.duration
            : sort === 'popular'
              ? b.popularity - a.popularity
              : Number(b.featured) - Number(a.featured),
    );
  function reset() {
    setQ('');
    setCategory('');
    setBudget('');
    setDuration('');
    setDate('');
    setTravelers('1');
    setSort('featured');
  }
  return (
    <>
      <button
        className="btn secondary mobile-filter-toggle"
        onClick={() => setMobile(!mobile)}
        aria-expanded={mobile}
      >
        <SlidersHorizontal size={16} />
        Filter experiences
      </button>
      <div className="filter-layout">
        <aside className={`filter-panel ${mobile ? 'mobile-visible' : ''}`}>
          <h3>Find your kind of trip</h3>
          <Field label="Destination or package">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try Palawan…" />
          </Field>
          <Field label="Experience">
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All experiences</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Budget per adult (PHP)">
            <select value={budget} onChange={(e) => setBudget(e.target.value)}>
              <option value="">Any budget</option>
              <option value="5000">Up to ₱5,000</option>
              <option value="10000">Up to ₱10,000</option>
              <option value="15000">Up to ₱15,000</option>
              <option value="25000">Up to ₱25,000</option>
            </select>
          </Field>
          <Field label="Trip duration">
            <select value={duration} onChange={(e) => setDuration(e.target.value)}>
              <option value="">Any duration</option>
              <option value="3">Up to 3 days</option>
              <option value="4">Up to 4 days</option>
              <option value="7">Up to a week</option>
            </select>
          </Field>
          <Field label="Departure date">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Travelers">
            <input
              type="number"
              min="1"
              max="100"
              value={travelers}
              onChange={(e) => setTravelers(e.target.value)}
            />
          </Field>
          <button className="text-link" onClick={reset}>
            <RotateCcw size={13} />
            Reset filters
          </button>
        </aside>
        <div>
          <div className="results-toolbar">
            <span>
              <strong>{filtered.length}</strong> experiences for your next story
            </span>
            <label>
              Sort by{' '}
              <select
                aria-label="Sort packages"
                className="control"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="featured">Featured first</option>
                <option value="popular">Most booked (verified)</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="duration">Shortest duration</option>
              </select>
            </label>
          </div>
          {filtered.length ? (
            <div className="tour-grid">
              {filtered.map((tour, i) => (
                <TourCard tour={tour} index={i + 1} key={tour.id} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Search size={30} />
              <h3>A different kind of adventure?</h3>
              <p>
                No departures match these filters. Try another date or destination, or clear your
                filters.
              </p>
              <button className="btn primary" onClick={reset}>
                Explore all experiences
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
