import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  LayoutDashboard,
  MapPin,
  Compass,
  Route,
  CalendarDays,
  ClipboardList,
  Wallet,
  Users,
  MessageSquare,
  Tag,
  Star,
  ChartColumn,
  FileText,
  Settings,
  History,
} from 'lucide-react';
import { currentUser } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { expireHolds } from '@/lib/booking';
import { AuthForm } from '@/components/forms';
import AdminConsole from '@/components/admin';
export const metadata = { title: 'Agency portal', robots: { index: false, follow: false } };
export default async function AdminPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const section = (await params).slug?.[0] || 'dashboard';
  if (section === 'login')
    return (
      <Suspense>
        <AuthForm admin />
      </Suspense>
    );
  const user = await currentUser();
  if (!user) redirect('/admin/login');
  if (!['SUPER_ADMIN', 'STAFF'].includes(user.role))
    return (
      <div className="container page-content">
        <div className="empty-state">
          <h1 style={{ fontSize: 32 }}>Agency access required.</h1>
          <p>This account has customer access. Your travel plans are in your customer dashboard.</p>
          <Link className="btn primary" href="/account">
            My travel dashboard
          </Link>
        </div>
      </div>
    );
  const links = [
    ['dashboard', 'Overview', LayoutDashboard],
    ['destinations', 'Destinations', MapPin],
    ['packages', 'Travel packages', Compass],
    ['itineraries', 'Itineraries', Route],
    ['departures', 'Departure schedules', CalendarDays],
    ['reservations', 'Reservations', ClipboardList],
    ['payments', 'Payment verification', Wallet],
    ['customers', 'Customers', Users],
    ['inquiries', 'Customized inquiries', MessageSquare],
    ['promotions', 'Promotions', Tag],
    ['reviews', 'Reviews', Star],
    ['reports', 'Reports', ChartColumn],
    ['content', 'Website content', FileText],
    ...(user.role === 'SUPER_ADMIN' ? [['settings', 'Settings', Settings] as const] : []),
    ['audit', 'Audit logs', History],
  ] as const;
  if (!links.some((l) => l[0] === section)) notFound();
  await expireHolds(await getDB());
  return (
    <div className="admin-page">
      <div className="container page-content dashboard-layout">
        <aside className="dashboard-nav">
          <small>AGENCY OPERATIONS</small>
          {links.map(([key, title, Icon]) => (
            <Link
              key={key}
              href={key === 'dashboard' ? '/admin' : '/admin/' + key}
              className={section === key ? 'active' : ''}
            >
              <Icon size={16} />
              {title}
            </Link>
          ))}
        </aside>
        <div style={{ minWidth: 0 }}>
          <AdminConsole key={section} section={section} user={JSON.parse(JSON.stringify(user))} />
        </div>
      </div>
    </div>
  );
}
