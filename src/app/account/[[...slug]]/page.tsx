import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { LayoutDashboard, CalendarDays, UserRound, Bell, MessageSquare } from 'lucide-react';
import { currentUser } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { expireHolds } from '@/lib/booking';
import type { Booking } from '@/lib/types';
import Account from '@/components/account';
export const metadata = { title: 'Your travel dashboard', robots: { index: false, follow: false } };
export default async function AccountPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const user = await currentUser();
  if (!user) redirect('/login?next=/account');
  const section = (await params).slug?.[0] || 'overview';
  const links = [
    ['overview', 'Dashboard', LayoutDashboard],
    ['bookings', 'My bookings', CalendarDays],
    ['inquiries', 'My inquiries', MessageSquare],
    ['profile', 'My profile', UserRound],
    ['notifications', 'Notifications', Bell],
  ] as const;
  if (!links.some((l) => l[0] === section)) notFound();
  const db = await getDB();
  await expireHolds(db);
  const bookings = (
    await db.query<Booking>(
      "SELECT b.*,COALESCE((SELECT sum(CASE WHEN kind='PAYMENT' THEN amount ELSE -amount END) FROM payments WHERE booking_id=b.id),0) paid FROM bookings b WHERE user_id=$1 ORDER BY created_at DESC",
      [user.id],
    )
  ).rows;
  return (
    <>
      <section className="page-banner">
        <div className="container">
          <span className="eyebrow">YOUR LITTLE CORNER OF THE WORLD</span>
          <h1>Hello, {user.name.split(' ')[0]}.</h1>
          <p>Your plans, your people, your next great adventure. All in one place.</p>
        </div>
      </section>
      <div className="container page-content dashboard-layout">
        <aside className="dashboard-nav">
          <small>YOUR TRAVEL COMPANION</small>
          {links.map(([key, title, Icon]) => (
            <Link
              className={key === section ? 'active' : ''}
              href={key === 'overview' ? '/account' : '/account/' + key}
              key={key}
            >
              <Icon size={17} />
              {title}
            </Link>
          ))}
        </aside>
        <div>
          <Account
            section={section}
            user={JSON.parse(JSON.stringify(user))}
            bookings={JSON.parse(JSON.stringify(bookings))}
          />
        </div>
      </div>
    </>
  );
}
