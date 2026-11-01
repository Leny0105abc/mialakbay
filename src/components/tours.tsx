import Link from 'next/link';
import { ArrowUpRight, MapPin, Clock, ArrowRight, Check } from 'lucide-react';
import type { Tour, Day } from '@/lib/types';
import { money } from '@/lib/format';
export function TourCard({ tour, index = 0 }: { tour: Tour; index?: number }) {
  return (
    <article className="tour-card">
      <Link href={`/packages/${tour.slug}`} className="tour-photo">
        <img
          src={tour.image_url}
          alt={`Illustrative scenery for ${tour.destination}`}
          loading="lazy"
        />
        <span className="photo-tag">{index === 0 ? 'A little escape' : tour.category}</span>
        <span className="photo-arrow">
          <ArrowUpRight size={19} />
        </span>
        {tour.demo && <span className="sample-photo">SAMPLE TRIP</span>}
      </Link>
      <div className="tour-content">
        <div className="tour-location">
          <MapPin size={13} />
          {tour.destination}
          <span>
            <Clock size={13} />
            {tour.duration}D / {tour.duration - 1}N
          </span>
        </div>
        <h3>
          <Link href={`/packages/${tour.slug}`}>{tour.title}</Link>
        </h3>
        <p>{tour.description}</p>
        <div className="tour-bottom">
          <div>
            <small>{tour.demo ? 'Sample price from' : 'From'} / person</small>
            <strong>{money(tour.adult_price)}</strong>
          </div>
          <Link href={`/packages/${tour.slug}`} aria-label={`Explore ${tour.title}`}>
            Explore trip <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  description,
  href,
  link = 'Explore all packages',
}: {
  eyebrow: string;
  title: string;
  description?: string;
  href?: string;
  link?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {href && (
        <Link href={href} className="text-link">
          {link}
          <ArrowUpRight size={17} />
        </Link>
      )}
    </div>
  );
}
export function Timeline({ days }: { days: Day[] }) {
  return (
    <div className="timeline">
      {days.map((day) => (
        <div className="timeline-day" key={day.id || day.day}>
          <span className="day-number">{String(day.day).padStart(2, '0')}</span>
          <div>
            <span className="eyebrow">DAY {day.day}</span>
            <h3>{day.title}</h3>
            {day.activities.map((a, i) => (
              <div className="activity" key={a.id || i}>
                <span>{a.time_label}</span>
                <div>
                  <h4>
                    {a.title}{' '}
                    <small className={a.included ? 'included' : 'optional'}>
                      {a.included ? 'Included' : 'Optional · extra cost'}
                    </small>
                  </h4>
                  <p>{a.description}</p>
                  {a.location && (
                    <small>
                      <MapPin size={12} />
                      {a.location}
                    </small>
                  )}
                  {a.photo_url && (
                    <img
                      src={a.photo_url}
                      alt={a.title}
                      className="activity-photo"
                      loading="lazy"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
export function Inclusions({ items }: { items: string[] }) {
  return (
    <ul className="check-list">
      {items.map((item) => (
        <li key={item}>
          <Check size={17} />
          {item}
        </li>
      ))}
    </ul>
  );
}
