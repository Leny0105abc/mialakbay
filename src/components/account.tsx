'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Compass,
  Bell,
  Wallet,
  ArrowUpRight,
  MessageSquare,
  LoaderCircle,
} from 'lucide-react';
import type { Booking, User, Inquiry } from '@/lib/types';
import { api, Message, useAction } from './ui';
import { money, date, label } from '@/lib/format';
import { ProfileForm } from './forms';
export function BookingCards({ items }: { items: Booking[] }) {
  return (
    <div className="booking-cards">
      {items.map((b) => (
        <article className="booking-list-card" key={b.id}>
          <img src={b.snapshot.image_url} alt={b.snapshot.destination} />
          <div>
            <span className="booking-ref">{b.reference}</span>
            <h3>
              <Link href={`/bookings/${b.reference}`}>{b.snapshot.title}</Link>
            </h3>
            <p>
              {date(b.snapshot.departure_at)} · {b.adults + b.children} travelers
            </p>
            <span className={`badge ${b.status.toLowerCase()}`}>{label(b.status)}</span>
          </div>
          <div className="price-block">
            <strong>{money(b.total)}</strong>
            <small>{money(b.paid || 0)} verified paid</small>
            <Link href={`/bookings/${b.reference}`} className="btn secondary small">
              View reservation <ArrowUpRight size={14} />
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
type Notification = {
  id: string;
  title: string;
  message: string;
  read_at: string | null;
  email_status: string;
  created_at: string;
};
type QuotedInquiry = Inquiry & {
  quotations: { amount: number; message: string; created_at: string }[];
};
export default function Account({
  section,
  user,
  bookings,
}: {
  section: string;
  user: User;
  bookings: Booking[];
}) {
  const state = useAction();
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const [inquiries, setInquiries] = useState<QuotedInquiry[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (section === 'notifications')
      api<Notification[]>('notifications')
        .then(setNotifications)
        .catch((e) => setError(e.message));
    if (section === 'inquiries')
      api<QuotedInquiry[]>('inquiries')
        .then(setInquiries)
        .catch((e) => setError(e.message));
  }, [section]);
  if (section === 'profile')
    return (
      <div className="panel" style={{ maxWidth: 650 }}>
        <h2>Your travel profile</h2>
        <p style={{ fontSize: 12 }}>A few details to make the next trip a little easier.</p>
        <ProfileForm user={user} />
      </div>
    );
  if (section === 'notifications')
    return (
      <div className="panel">
        <div className="admin-heading">
          <h2>Your updates</h2>
          <button
            className="btn secondary small"
            disabled={state.busy}
            onClick={() =>
              state.run(async () => {
                await api('notifications', {});
                setNotifications(await api<Notification[]>('notifications'));
              }, 'All updates marked as read.')
            }
          >
            Mark all read
          </button>
        </div>
        <Message error={error || state.error} success={state.success} />
        {!notifications ? (
          <div className="loading">
            <LoaderCircle className="spin" />
          </div>
        ) : notifications.length ? (
          notifications.map((n) => (
            <article className={`notification ${n.read_at ? '' : 'unread'}`} key={n.id}>
              <Bell size={18} />
              <div>
                <h3>{n.title}</h3>
                <p>{n.message}</p>
                <small>
                  {date(n.created_at)} · Email: {label(n.email_status)}
                </small>
              </div>
            </article>
          ))
        ) : (
          <Empty
            title="A quiet moment."
            text="Your reservation and payment updates will appear here."
          />
        )}
      </div>
    );
  if (section === 'inquiries')
    return (
      <>
        <Message error={error} />
        {!inquiries ? (
          <div className="loading">
            <LoaderCircle className="spin" />
          </div>
        ) : inquiries.length ? (
          inquiries.map((i) => (
            <article className="panel inquiry-card" key={i.id}>
              <div className="admin-heading">
                <div>
                  <span className="eyebrow">YOUR CUSTOM ADVENTURE</span>
                  <h3>{i.destination}</h3>
                </div>
                <span className="badge">{label(i.status)}</span>
              </div>
              <p style={{ fontSize: 12 }}>
                {date(i.start_date)} – {date(i.end_date)} · {i.travelers} travelers · Budget{' '}
                {money(i.budget)}
              </p>
              <p style={{ fontSize: 12 }}>{i.requests}</p>
              {i.quotations.map((q, n) => (
                <div className="quotation" key={n}>
                  <strong>Agency quotation: {money(q.amount)}</strong>
                  <p>{q.message}</p>
                  <small>
                    {date(q.created_at)} · Inquiry quotation; no automatic booking or payment
                  </small>
                </div>
              ))}
            </article>
          ))
        ) : (
          <Empty
            title="A trip of your own."
            text="Your customized travel requests and agency quotations will appear here."
            href="/custom-tour"
            link="Plan my custom trip"
          />
        )}
      </>
    );
  if (section === 'bookings')
    return bookings.length ? (
      <BookingCards items={bookings} />
    ) : (
      <Empty
        title="Your next story is waiting."
        text="No reservations yet. Find a place you’ve been meaning to go."
        href="/packages"
        link="Explore experiences"
      />
    );
  const upcoming = bookings.filter(
    (b) =>
      ['CONFIRMED', 'PENDING_PAYMENT', 'PAYMENT_UNDER_REVIEW', 'PENDING_REVIEW'].includes(
        b.status,
      ) && new Date(b.snapshot.departure_at) > new Date(),
  );
  return (
    <>
      <div className="stats-grid">
        <div className="stat-card">
          <span>
            All reservations
            <Compass size={16} />
          </span>
          <strong>{bookings.length}</strong>
        </div>
        <div className="stat-card">
          <span>
            Upcoming trips
            <CalendarDays size={16} />
          </span>
          <strong>{upcoming.length}</strong>
        </div>
        <div className="stat-card">
          <span>
            Confirmed
            <ShieldIcon />
          </span>
          <strong>{bookings.filter((b) => b.status === 'CONFIRMED').length}</strong>
        </div>
        <div className="stat-card">
          <span>
            Verified net paid
            <Wallet size={16} />
          </span>
          <strong style={{ fontSize: 24 }}>
            {money(bookings.reduce((sum, b) => sum + (b.paid || 0), 0))}
          </strong>
        </div>
      </div>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">SOMETHING TO LOOK FORWARD TO</span>
          <h2 style={{ fontSize: 25, margin: 0 }}>Your upcoming adventures</h2>
        </div>
        <Link href="/account/bookings" className="text-link">
          All reservations <ArrowUpRight size={15} />
        </Link>
      </div>
      {upcoming.length ? (
        <BookingCards items={upcoming} />
      ) : (
        <Empty
          title="Make room for a little adventure."
          text="Your next destination is out there. Let’s go find it."
          href="/packages"
          link="Find my next trip"
        />
      )}
      <div
        className="panel"
        style={{ marginTop: 25, display: 'flex', gap: 20, alignItems: 'center' }}
      >
        <MessageSquare size={28} color="var(--teal)" />
        <div>
          <h3 style={{ fontSize: 17, marginBottom: 6 }}>Something special in mind?</h3>
          <p style={{ fontSize: 11, marginBottom: 12 }}>
            Tell us your dream itinerary and we’ll help with the details.
          </p>
          <Link href="/custom-tour" className="text-link">
            Create your own trip <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </>
  );
}
function ShieldIcon() {
  return <span>✓</span>;
}
function Empty({
  title,
  text,
  href,
  link,
}: {
  title: string;
  text: string;
  href?: string;
  link?: string;
}) {
  return (
    <div className="empty-state">
      <Compass size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
      {href && (
        <Link href={href} className="btn primary">
          {link}
        </Link>
      )}
    </div>
  );
}
