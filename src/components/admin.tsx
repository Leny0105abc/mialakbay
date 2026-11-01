'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Plus,
  Download,
  Search,
  X,
  LoaderCircle,
  Pencil,
  ArrowUpRight,
  Upload,
  CalendarDays,
  Wallet,
  Users,
  Compass,
  ClipboardList,
  CheckCircle2,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { api, Field, PasswordField, Message, Submit, useAction, formValues } from './ui';
import { money, date, label, categories, statuses } from '@/lib/format';
import type { User, Tour, Day, Settings, Booking } from '@/lib/types';
type Row = Record<string, unknown>;
type AdminData = {
  items?: Row[];
  packages?: Tour[];
  bookings?: Row[];
  destinations?: Row[];
  images?: Row[];
  settings?: Settings;
  staff?: User[];
  emailConfigured?: boolean;
  stats?: {
    bookings: number;
    pending: number;
    confirmed: number;
    customers: number;
    packages: number;
    departures: number;
    payments: number;
    revenue: number;
    inquiries: number;
  };
  monthly?: { month: string; bookings: number; revenue: number }[];
  recent?: Row[];
  inquiries?: Row[];
};
const s = (r: Row, k: string) => (r[k] == null ? '' : String(r[k]));
const n = (r: Row, k: string) => Number(r[k] || 0);
const b = (r: Row, k: string) => Boolean(r[k]);
const names: Record<string, string> = {
  dashboard: 'Dashboard',
  destinations: 'Destinations',
  packages: 'Travel packages',
  itineraries: 'Itineraries',
  departures: 'Departure schedules',
  reservations: 'Reservations',
  payments: 'Payment verification',
  customers: 'Customers',
  inquiries: 'Customized inquiries',
  promotions: 'Promotions',
  reviews: 'Customer reviews',
  reports: 'Business reports',
  content: 'Website content',
  settings: 'Settings',
  audit: 'Audit logs',
};
const description: Record<string, string> = {
  dashboard: 'A little perspective on your agency’s journeys.',
  reservations: 'Every reservation, with its original itinerary and pricing.',
  payments: 'Verify actual receipts before recording a payment.',
  reports: 'Recorded transactions, with no estimates or simulated revenue.',
  departures: 'Manage departure times, booking deadlines, and seat capacity.',
  inquiries: 'Turn a travel wish list into a thoughtful quotation.',
  audit: 'A record of important administrative changes.',
};
function Status({ value }: { value: string }) {
  return <span className={'badge ' + value.toLowerCase()}>{label(value)}</span>;
}
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
export default function AdminConsole({ section, user }: { section: string; user: User }) {
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState('');
  const [edit, setEdit] = useState<Row | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [destination, setDestination] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [chart, setChart] = useState('revenue');
  const load = useCallback(async () => {
    try {
      const result = await api<AdminData>('admin/' + section);
      setData(result);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load records.');
    }
  }, [section]);
  useEffect(() => {
    let active = true;
    api<AdminData>('admin/' + section)
      .then((result) => {
        if (active) {
          setData(result);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [section]);
  const canCreate = ['packages', 'destinations', 'departures', 'promotions', 'content'].includes(
    section,
  );
  const isOverview = section === 'dashboard' || section === 'reports';
  const items = (data?.items || []).filter((r) => {
    const text = JSON.stringify(r).toLowerCase();
    return (
      (!query || text.includes(query.toLowerCase())) &&
      (!status || s(r, 'status') === status) &&
      (!destination || text.includes(destination.toLowerCase())) &&
      (!fromDate || new Date(s(r, 'created_at') || s(r, 'departure_at')) >= new Date(fromDate))
    );
  });
  const editButton = (r: Row, text = 'Edit') => (
    <button className="btn secondary small" onClick={() => setEdit(r)}>
      <Pencil size={12} />
      {text}
    </button>
  );
  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">LAKBAY AGENCY PORTAL</span>
          <h1>{names[section]}</h1>
          <p>{description[section] || 'Keep the details current, so every journey starts well.'}</p>
        </div>
        <div className="row-actions">
          {['reports', 'reservations', 'dashboard'].includes(section) && (
            <a className="btn secondary" href="/api/admin/export" download>
              <Download size={14} />
              Export CSV
            </a>
          )}
          {canCreate && (
            <button className="btn primary" onClick={() => setEdit({})}>
              <Plus size={15} />
              {section === 'content'
                ? 'Add content'
                : section === 'packages'
                  ? 'Create package'
                  : 'Add new'}
            </button>
          )}
        </div>
      </div>
      <Message error={error} />
      {!data && !error ? (
        <div className="loading">
          <LoaderCircle className="spin" />
          Loading agency records…
        </div>
      ) : null}
      {data && isOverview && data.stats && (
        <>
          <div className="stats-grid">
            {[
              [ClipboardList, 'Total bookings', data.stats.bookings, 'All recorded reservations'],
              [
                CalendarDays,
                'Pending reservations',
                data.stats.pending,
                'Awaiting payment or review',
              ],
              [CheckCircle2, 'Confirmed', data.stats.confirmed, 'Verified deposit received'],
              [
                Wallet,
                'Net recorded revenue',
                money(data.stats.revenue),
                'Verified receipts less recorded refunds',
              ],
              [Users, 'Customers', data.stats.customers, 'Registered customer accounts'],
              [Compass, 'Active packages', data.stats.packages, 'Published packages'],
              [
                CalendarDays,
                'Upcoming departures',
                data.stats.departures,
                'Open upcoming schedules',
              ],
              [Wallet, 'Recorded payments', data.stats.payments, 'Verified payment ledger entries'],
            ].map(([Icon, title, value, note]) => {
              const I = Icon as typeof Wallet;
              return (
                <div className="stat-card" key={String(title)}>
                  <span>
                    {String(title)}
                    <I size={16} />
                  </span>
                  <strong style={{ fontSize: typeof value === 'string' ? 25 : 30 }}>
                    {String(value)}
                  </strong>
                  <small>{String(note)}</small>
                </div>
              );
            })}
          </div>
          <div className="panel chart-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>{chart === 'revenue' ? 'Recorded revenue' : 'Reservations'} by month</h3>
              <div className="chart-tabs">
                <button
                  className={chart === 'revenue' ? 'active' : ''}
                  onClick={() => setChart('revenue')}
                >
                  Revenue
                </button>
                <button
                  className={chart === 'bookings' ? 'active' : ''}
                  onClick={() => setChart('bookings')}
                >
                  Bookings
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={215}>
              <BarChart data={data.monthly} margin={{ top: 10, right: 15, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5ece1" />
                <XAxis dataKey="month" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                  tickFormatter={(v) =>
                    chart === 'revenue' ? '₱' + (Number(v) >= 1000 ? Number(v) / 1000 + 'k' : v) : v
                  }
                />
                <Tooltip formatter={(v) => (chart === 'revenue' ? money(Number(v) * 100) : v)} />
                <Bar dataKey={chart} fill="#168576" radius={[4, 4, 0, 0]} maxBarSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-description">
            Revenue = verified payment ledger receipts minus recorded offline refunds, grouped by
            receipt month in Asia/Manila. Reservation value and unverified submissions are excluded.
            Test transactions, if you create any, are included.
          </p>
          <div className="admin-columns">
            <div className="panel">
              <h3>Recent reservations</h3>
              {data.recent?.length ? (
                <Table headers={['Reference', 'Traveler', 'Status', 'Value']}>
                  {data.recent.map((r) => (
                    <tr key={s(r, 'reference')}>
                      <td>
                        <Link
                          href={'/bookings/' + s(r, 'reference')}
                          style={{ color: 'var(--teal)' }}
                        >
                          {s(r, 'reference')}
                        </Link>
                      </td>
                      <td>{s(r, 'contact_name')}</td>
                      <td>
                        <Status value={s(r, 'status')} />
                      </td>
                      <td>{money(n(r, 'total'))}</td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <p style={{ fontSize: 12 }}>No reservations have been recorded yet.</p>
              )}
            </div>
            <div className="panel">
              <h3>
                Recent inquiries <span className="badge">{data.stats.inquiries} open</span>
              </h3>
              {data.inquiries?.length ? (
                data.inquiries.map((i) => (
                  <div className="departure-item" key={s(i, 'id')}>
                    <div>
                      <h3>{s(i, 'destination')}</h3>
                      <p>
                        {s(i, 'name')} · {date(s(i, 'created_at'))}
                      </p>
                    </div>
                    <Link href="/admin/inquiries" className="text-link">
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 12 }}>New custom travel inquiries will appear here.</p>
              )}
            </div>
          </div>
        </>
      )}
      {data && !isOverview && section !== 'settings' && (
        <>
          <div className="toolbar-filters">
            <input
              className="control"
              aria-label="Search records"
              placeholder={'Search ' + names[section].toLowerCase() + '…'}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {['reservations', 'payments', 'reviews', 'inquiries'].includes(section) && (
              <select
                className="control"
                aria-label="Filter by status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All statuses</option>
                {(section === 'reservations'
                  ? statuses
                  : section === 'payments'
                    ? ['UNDER_REVIEW', 'VERIFIED', 'REJECTED']
                    : section === 'reviews'
                      ? ['PENDING', 'APPROVED', 'REJECTED']
                      : ['NEW', 'IN_PROGRESS', 'QUOTED', 'CLOSED']
                ).map((s) => (
                  <option value={s} key={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            )}
            {section === 'reservations' && (
              <>
                <input
                  className="control"
                  aria-label="Filter by destination"
                  placeholder="Destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
                <input
                  className="control"
                  aria-label="Created on or after"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </>
            )}
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{items.length} records</span>
          </div>
          {!items.length ? (
            <div className="empty-state">
              <Search size={30} />
              <h3>Nothing here just yet.</h3>
              <p>
                {query || status
                  ? 'No records match your filters.'
                  : 'Records will appear as you and your customers use the application.'}
              </p>
              {canCreate && (
                <button className="btn primary" onClick={() => setEdit({})}>
                  Add the first record
                </button>
              )}
            </div>
          ) : section === 'packages' ? (
            <Table headers={['Package', 'Destination', 'Price', 'Status', 'Actions']}>
              {items.map((r) => (
                <tr key={s(r, 'id')}>
                  <td>
                    <strong>{s(r, 'title')}</strong>
                    <small>
                      {n(r, 'duration')} days · {s(r, 'category')}
                      {r.demo ? ' · Sample' : ''}
                    </small>
                  </td>
                  <td>{s(r, 'destination')}</td>
                  <td>{money(n(r, 'adult_price'))}</td>
                  <td>
                    <Status value={s(r, 'status')} />
                  </td>
                  <td>
                    <div className="row-actions">
                      {editButton(r)}
                      {r.status === 'PUBLISHED' && (
                        <Link className="btn secondary small" href={'/packages/' + s(r, 'slug')}>
                          View <ArrowUpRight size={12} />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          ) : section === 'destinations' ? (
            <Table headers={['Destination', 'Country', 'Featured', 'Actions']}>
              {items.map((r) => (
                <tr key={s(r, 'id')}>
                  <td>
                    <strong>{s(r, 'name')}</strong>
                  </td>
                  <td>{s(r, 'country')}</td>
                  <td>{r.featured ? 'Featured' : '—'}</td>
                  <td>{editButton(r)}</td>
                </tr>
              ))}
            </Table>
          ) : section === 'departures' ? (
            <Table
              headers={[
                'Experience',
                'Departure · PHT',
                'Deadline · PHT',
                'Seats',
                'Adjustment',
                'Status',
                'Actions',
              ]}
            >
              {items.map((r) => (
                <tr key={s(r, 'id')}>
                  <td>{s(r, 'title')}</td>
                  <td>
                    {date(s(r, 'departure_at'), {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>{date(s(r, 'booking_deadline'))}</td>
                  <td>
                    {n(r, 'reserved')} / {n(r, 'capacity')} reserved
                  </td>
                  <td>+{money(n(r, 'price_adjustment'))}</td>
                  <td>
                    <Status value={r.available ? 'OPEN' : 'CLOSED'} />
                  </td>
                  <td>{editButton(r)}</td>
                </tr>
              ))}
            </Table>
          ) : section === 'reservations' ? (
            <Table
              headers={[
                'Reference',
                'Customer',
                'Experience',
                'Departure',
                'Status',
                'Total / paid',
                'Actions',
              ]}
            >
              {items.map((r) => {
                const snap = r.snapshot as Booking['snapshot'];
                return (
                  <tr key={s(r, 'id')}>
                    <td>
                      <strong>{s(r, 'reference')}</strong>
                      <small>{date(s(r, 'created_at'))}</small>
                    </td>
                    <td>
                      {s(r, 'contact_name')}
                      <small>{s(r, 'contact_email')}</small>
                    </td>
                    <td>
                      {snap.title}
                      <small>{n(r, 'adults') + n(r, 'children')} travelers</small>
                    </td>
                    <td>{date(snap.departure_at)}</td>
                    <td>
                      <Status value={s(r, 'status')} />
                    </td>
                    <td>
                      {money(n(r, 'total'))}
                      <small>{money(n(r, 'paid'))} verified paid</small>
                    </td>
                    <td>
                      <Link className="btn secondary small" href={'/bookings/' + s(r, 'reference')}>
                        Review <ArrowUpRight size={12} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </Table>
          ) : section === 'payments' ? (
            <Table headers={['Booking', 'Customer', 'Payment', 'Reference', 'Status', 'Actions']}>
              {items.map((r) => (
                <tr key={s(r, 'id')}>
                  <td>{s(r, 'booking_reference')}</td>
                  <td>{s(r, 'contact_name')}</td>
                  <td>
                    {money(n(r, 'amount'))}
                    <small>
                      {label(s(r, 'method'))} · {date(s(r, 'created_at'))}
                    </small>
                  </td>
                  <td>{s(r, 'reference')}</td>
                  <td>
                    <Status value={s(r, 'status')} />
                  </td>
                  <td>
                    <Link
                      className="btn secondary small"
                      href={'/bookings/' + s(r, 'booking_reference')}
                    >
                      Review receipt
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
          ) : section === 'customers' ? (
            <Table headers={['Customer', 'Contact', 'Bookings', 'Joined', 'Actions']}>
              {items.map((r) => (
                <tr key={s(r, 'id')}>
                  <td>
                    <strong>{s(r, 'name')}</strong>
                  </td>
                  <td>
                    {s(r, 'email')}
                    <small>{s(r, 'phone')}</small>
                  </td>
                  <td>{n(r, 'bookings')}</td>
                  <td>{date(s(r, 'created_at'))}</td>
                  <td>{editButton(r, 'Profile & history')}</td>
                </tr>
              ))}
            </Table>
          ) : section === 'inquiries' ? (
            <Table
              headers={[
                'Customer',
                'Travel request',
                'Dates',
                'Travelers / budget',
                'Status',
                'Actions',
              ]}
            >
              {items.map((r) => (
                <tr key={s(r, 'id')}>
                  <td>
                    {s(r, 'name')}
                    <small>{s(r, 'email')}</small>
                  </td>
                  <td>{s(r, 'destination')}</td>
                  <td>
                    {date(s(r, 'start_date'))}
                    <small>to {date(s(r, 'end_date'))}</small>
                  </td>
                  <td>
                    {n(r, 'travelers')} travelers<small>{money(n(r, 'budget'))}</small>
                  </td>
                  <td>
                    <Status value={s(r, 'status')} />
                  </td>
                  <td>{editButton(r, 'Review & quote')}</td>
                </tr>
              ))}
            </Table>
          ) : section === 'promotions' ? (
            <Table
              headers={['Promotion', 'Discount', 'Validity', 'Redemptions', 'Status', 'Actions']}
            >
              {items.map((r) => (
                <tr key={s(r, 'id')}>
                  <td>
                    <strong>{s(r, 'name')}</strong>
                    <small>{s(r, 'code')}</small>
                  </td>
                  <td>
                    {r.discount_type === 'PERCENT' ? n(r, 'value') + '%' : money(n(r, 'value'))}
                    <small>Minimum {money(n(r, 'min_total'))}</small>
                  </td>
                  <td>
                    {date(s(r, 'starts_at'))}
                    <small>until {date(s(r, 'ends_at'))}</small>
                  </td>
                  <td>
                    {n(r, 'used')} / {n(r, 'usage_limit')}
                  </td>
                  <td>
                    <Status value={r.active ? 'ACTIVE' : 'INACTIVE'} />
                  </td>
                  <td>{editButton(r)}</td>
                </tr>
              ))}
            </Table>
          ) : section === 'reviews' ? (
            <Table headers={['Customer / trip', 'Rating', 'Review', 'Status', 'Actions']}>
              {items.map((r) => (
                <tr key={s(r, 'id')}>
                  <td>
                    {s(r, 'name')}
                    <small>{s(r, 'title')}</small>
                  </td>
                  <td>{'★'.repeat(n(r, 'rating'))}</td>
                  <td style={{ whiteSpace: 'normal', minWidth: 230 }}>{s(r, 'body')}</td>
                  <td>
                    <Status value={s(r, 'status')} />
                  </td>
                  <td>{editButton(r, 'Moderate')}</td>
                </tr>
              ))}
            </Table>
          ) : section === 'content' ? (
            <Table headers={['Page / key', 'Title', 'Last updated', 'Actions']}>
              {items.map((r) => (
                <tr key={s(r, 'key')}>
                  <td>{s(r, 'key')}</td>
                  <td>{s(r, 'title')}</td>
                  <td>{date(s(r, 'updated_at'))}</td>
                  <td>{editButton(r)}</td>
                </tr>
              ))}
            </Table>
          ) : section === 'itineraries' ? (
            <Table headers={['Experience', 'Duration', 'Status', 'Actions']}>
              {items.map((r) => (
                <tr key={s(r, 'id')}>
                  <td>{s(r, 'title')}</td>
                  <td>{n(r, 'duration')} days</td>
                  <td>
                    <Status value={s(r, 'status')} />
                  </td>
                  <td>{editButton(r, 'Edit itinerary')}</td>
                </tr>
              ))}
            </Table>
          ) : section === 'audit' ? (
            <Table headers={['Time · PHT', 'Staff member', 'Action', 'Entity', 'Details']}>
              {items.map((r) => (
                <tr key={s(r, 'id')}>
                  <td>
                    {date(s(r, 'created_at'), {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>{s(r, 'name')}</td>
                  <td>{label(s(r, 'action'))}</td>
                  <td>
                    {s(r, 'entity_type')}
                    <small>{s(r, 'entity_id')}</small>
                  </td>
                  <td style={{ whiteSpace: 'normal', minWidth: 200, fontSize: 10 }}>
                    {JSON.stringify(r.detail)}
                  </td>
                </tr>
              ))}
            </Table>
          ) : null}
        </>
      )}
      {data && section === 'settings' && data.settings && (
        <>
          <div className="notice">
            Card processing is disabled. Payment instructions are customer-visible; enter business
            collection details only. Email provider secrets belong in server environment variables.
          </div>
          <EditForm
            section="settings"
            row={data.settings as unknown as Row}
            data={data}
            onDone={load}
          />
          <section className="panel" style={{ marginTop: 25 }}>
            <div className="admin-heading">
              <h3>Agency team</h3>
              {user.role === 'SUPER_ADMIN' && (
                <button className="btn secondary small" onClick={() => setEdit({ staff: true })}>
                  <Plus size={13} />
                  Add staff
                </button>
              )}
            </div>
            <Table headers={['Name', 'Email', 'Role']}>
              {data.staff?.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{label(u.role)}</td>
                </tr>
              ))}
            </Table>
            <p className="mini-note" style={{ textAlign: 'left' }}>
              Transactional email:{' '}
              {data.emailConfigured
                ? 'provider configured; delivery statuses appear in notifications.'
                : 'not configured. Only in-app notifications are created.'}
            </p>
          </section>
        </>
      )}
      {edit && data && (
        <Modal
          title={
            edit.staff
              ? 'Add agency staff'
              : section === 'itineraries'
                ? 'Shape the itinerary'
                : `${Object.keys(edit).length ? 'Edit' : 'Create'} ${names[section].toLowerCase()}`
          }
          close={() => setEdit(null)}
        >
          {section === 'itineraries' ? (
            <ItineraryEditor
              row={edit}
              onDone={async () => {
                setEdit(null);
                await load();
              }}
            />
          ) : (
            <EditForm
              section={edit.staff ? 'staff' : section}
              row={edit}
              data={data}
              onDone={async () => {
                setEdit(null);
                await load();
              }}
            />
          )}
        </Modal>
      )}
    </>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const focusable = ref.current?.querySelectorAll<HTMLElement>(
          'button,a,input,select,textarea,[tabindex="0"]',
        );
        if (!focusable?.length) return;
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', listener);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', listener);
      old?.focus();
    };
  }, [close]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        ref={ref}
        tabIndex={-1}
      >
        <div className="modal-title">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Close dialog" onClick={close}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function localDate(value: unknown) {
  if (!value) return '';
  return new Date(new Date(String(value)).getTime() + 8 * 3600000).toISOString().slice(0, 16);
}
function EditForm({
  section,
  row: r,
  data,
  onDone,
}: {
  section: string;
  row: Row;
  data: AdminData;
  onDone: () => void | Promise<void>;
}) {
  const state = useAction();
  const [imageText, setImageText] = useState(
    section === 'packages'
      ? (data.images || [])
          .filter((i) => i.package_id === r.id)
          .map((i) => s(i, 'url'))
          .join('\n')
      : s(r, 'image_url'),
  );
  const [uploadError, setUploadError] = useState('');
  const input = (
    key: string,
    title: string,
    type = 'text',
    required = true,
    def?: string | number,
  ) => (
    <Field label={title}>
      <input
        name={key}
        type={type}
        defaultValue={def ?? s(r, key)}
        required={required}
        step={type === 'number' ? '0.01' : undefined}
        maxLength={type === 'text' ? 2000 : undefined}
      />
    </Field>
  );
  const area = (key: string, title: string, def?: string, required = true) => (
    <Field label={title}>
      <textarea
        name={key}
        defaultValue={def ?? s(r, key)}
        required={required}
        maxLength={key === 'body' ? 30000 : 10000}
      />
    </Field>
  );
  const select = (key: string, title: string, options: [string, string][], def?: string) => (
    <Field label={title}>
      <select name={key} defaultValue={def ?? s(r, key)} required>
        <option value="" disabled>
          Select an option
        </option>
        {options.map(([value, label]) => (
          <option value={value} key={value}>
            {label}
          </option>
        ))}
      </select>
    </Field>
  );
  const check = (key: string, title: string, def?: boolean) => (
    <label className="checkbox">
      <input type="checkbox" name={key} defaultChecked={def ?? b(r, key)} />
      <span>{title}</span>
    </label>
  );
  async function upload(file: File) {
    setUploadError('');
    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setImageText((old) =>
        section === 'packages' ? (old ? old + '\n' : '') + result.url : result.url,
      );
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
    }
  }
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const v = formValues(e);
        const checked = (key: string) =>
          (form.elements.namedItem(key) as HTMLInputElement)?.checked || false;
        const cents = (key: string) => Math.round(Number(v[key]) * 100);
        const iso = (key: string) => new Date(v[key] + '+08:00').toISOString();
        let payload: unknown = { ...v, ...(r.id ? { id: r.id } : {}) };
        if (section === 'packages')
          payload = {
            ...v,
            ...(r.id ? { id: r.id } : {}),
            adult_price: cents('adult_price'),
            child_price: cents('child_price'),
            inclusions: v.inclusions.split('\n').filter(Boolean),
            exclusions: v.exclusions.split('\n').filter(Boolean),
            featured: checked('featured'),
            demo: checked('demo'),
            images: imageText
              .split('\n')
              .map((u) => u.trim())
              .filter(Boolean),
          };
        if (section === 'destinations')
          payload = {
            ...v,
            ...(r.id ? { id: r.id } : {}),
            featured: checked('featured'),
            image_url: imageText,
          };
        if (section === 'departures')
          payload = {
            ...v,
            ...(r.id ? { id: r.id } : {}),
            departure_at: iso('departure_at'),
            booking_deadline: iso('booking_deadline'),
            price_adjustment: cents('price_adjustment'),
            available: checked('available'),
          };
        if (section === 'promotions')
          payload = {
            ...v,
            ...(r.id ? { id: r.id } : {}),
            value: v.discount_type === 'FIXED' ? cents('value') : Number(v.value),
            min_total: cents('min_total'),
            starts_at: iso('starts_at'),
            ends_at: iso('ends_at'),
            active: checked('active'),
            package_ids: new FormData(form).getAll('package_ids'),
          };
        if (section === 'inquiries')
          payload = { id: r.id, status: v.status, message: v.message, amount: cents('amount') };
        if (section === 'settings')
          payload = {
            ...v,
            payment_instructions: { GCASH: v.GCASH, MAYA: v.MAYA, BANK: v.BANK, CASH: v.CASH },
          };
        state.run(async () => {
          await api('admin/' + section, payload);
          await onDone();
        });
      }}
    >
      <div className="form-grid">
        {section === 'packages' && (
          <>
            {input('title', 'Package title')}
            {input('slug', 'URL slug')}
            <Field label="Destination">
              <select name="destination_id" defaultValue={s(r, 'destination_id')} required>
                <option value="">Select destination</option>
                {data.destinations?.map((d) => (
                  <option value={s(d, 'id')} key={s(d, 'id')}>
                    {s(d, 'name')}
                  </option>
                ))}
              </select>
            </Field>
            {select(
              'category',
              'Experience category',
              categories.map((c) => [c, c]),
            )}
            {area('description', 'Overview')}
            {input('duration', 'Duration in days', 'number', true, n(r, 'duration') || 3)}
            {input(
              'min_participants',
              'Minimum travelers',
              'number',
              true,
              n(r, 'min_participants') || 1,
            )}
            {input(
              'max_participants',
              'Maximum travelers',
              'number',
              true,
              n(r, 'max_participants') || 20,
            )}
            {input(
              'adult_price',
              'Adult price (PHP)',
              'number',
              true,
              n(r, 'adult_price') / 100 || '',
            )}
            {input('child_price', 'Child price (PHP)', 'number', true, n(r, 'child_price') / 100)}
            {input(
              'deposit_percent',
              'Deposit percentage',
              'number',
              true,
              n(r, 'deposit_percent') || 30,
            )}
            {input('meeting_point', 'Meeting point')}
            {area('transportation', 'Transportation')}
            {area('accommodation', 'Accommodation')}
            {area('meals', 'Meal inclusions')}
            {area('guide', 'Guide availability')}
            {area(
              'inclusions',
              'Included services (one per line)',
              ((r.inclusions as string[]) || []).join('\n'),
            )}
            {area(
              'exclusions',
              'Excluded / optional (one per line)',
              ((r.exclusions as string[]) || []).join('\n'),
              false,
            )}
            {area('policies', 'Booking & cancellation policy')}
            {area('notes', 'Additional requirements / notes', undefined, false)}
            {select(
              'status',
              'Publication status',
              [
                ['DRAFT', 'Draft'],
                ['PUBLISHED', 'Published'],
                ['ARCHIVED', 'Archived'],
              ],
              s(r, 'status') || 'DRAFT',
            )}
            {check('featured', 'Feature on homepage')}
            {check('demo', 'Clearly label as sample data', r.id ? b(r, 'demo') : true)}
            <div className="span-2">
              <Field label="Gallery images (one URL per line)">
                <textarea
                  value={imageText}
                  onChange={(e) => setImageText(e.target.value)}
                  required
                  placeholder="Upload images below or use images.unsplash.com URLs"
                />
              </Field>
            </div>
            <p className="muted span-2" style={{ fontSize: 11 }}>
              After saving, configure one itinerary day per package day and add departure schedules.
              Existing reservations keep their original price and itinerary.
            </p>
          </>
        )}
        {section === 'destinations' && (
          <>
            {input('name', 'Destination name')}
            {input('country', 'Country', 'text', true, s(r, 'country') || 'Philippines')}
            {area('description', 'Description')}
            <Field label="Image URL">
              <input value={imageText} onChange={(e) => setImageText(e.target.value)} required />
            </Field>
            {check('featured', 'Feature on homepage')}
          </>
        )}
        {section === 'departures' && (
          <>
            {select(
              'package_id',
              'Travel package',
              (data.packages || []).map((p) => [p.id, p.title]),
            )}
            {input(
              'departure_at',
              'Departure time (Asia/Manila)',
              'datetime-local',
              true,
              localDate(r.departure_at),
            )}
            {input(
              'booking_deadline',
              'Booking deadline (Asia/Manila)',
              'datetime-local',
              true,
              localDate(r.booking_deadline),
            )}
            {input('capacity', 'Total seat capacity', 'number', true, n(r, 'capacity') || 20)}
            {input(
              'price_adjustment',
              'Seasonal surcharge per person (PHP)',
              'number',
              true,
              n(r, 'price_adjustment') / 100,
            )}
            {check('available', 'Open for reservations', r.id ? b(r, 'available') : true)}
            <p className="span-2 muted" style={{ fontSize: 11 }}>
              Available seats = capacity minus reserved travelers. Booked departures retain their
              package and departure time.
            </p>
          </>
        )}
        {section === 'promotions' && (
          <>
            {input('name', 'Promotion name')}
            {input('code', 'Discount code (uppercase)')}
            {select(
              'discount_type',
              'Discount type',
              [
                ['PERCENT', 'Percentage'],
                ['FIXED', 'Fixed amount in PHP'],
              ],
              s(r, 'discount_type') || 'PERCENT',
            )}
            {input(
              'value',
              'Discount value (% or PHP)',
              'number',
              true,
              r.discount_type === 'FIXED' ? n(r, 'value') / 100 : n(r, 'value') || 10,
            )}
            {input(
              'starts_at',
              'Starts (Asia/Manila)',
              'datetime-local',
              true,
              localDate(r.starts_at),
            )}
            {input('ends_at', 'Ends (Asia/Manila)', 'datetime-local', true, localDate(r.ends_at))}
            {input('usage_limit', 'Usage limit', 'number', true, n(r, 'usage_limit') || 100)}
            {input(
              'min_total',
              'Minimum booking value (PHP)',
              'number',
              true,
              n(r, 'min_total') / 100,
            )}
            {check('active', 'Promotion is active', r.id ? b(r, 'active') : true)}
            <div className="span-2">
              <h4>Eligible packages</h4>
              <p style={{ fontSize: 11 }}>Leave all unchecked to include every package.</p>
              <div className="form-grid">
                {data.packages?.map((p) => (
                  <label className="checkbox" key={p.id}>
                    <input
                      type="checkbox"
                      name="package_ids"
                      value={p.id}
                      defaultChecked={((r.package_ids as string[]) || []).includes(p.id)}
                    />
                    {p.title}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}
        {section === 'content' && (
          <>
            {input(
              'key',
              'Content key (about, home, faq, blog-slug, privacy, terms, cancellation)',
            )}
            {input('title', 'Heading / article title')}
            <div className="span-2">
              {area('body', 'Content (FAQ: one Question|Answer per line)')}
            </div>
            <p className="span-2 muted" style={{ fontSize: 11 }}>
              Content is rendered as plain text. Blog keys begin with blog-. Homepage: key home.
              Legal content must be reviewed for your actual business.
            </p>
          </>
        )}
        {section === 'customers' && (
          <>
            {input('name', 'Customer name')}
            {input('phone', 'Phone', 'tel', false)}
            {area('address', 'Address', undefined, false)}
            <div className="span-2">
              <h4>Booking history</h4>
              <p style={{ fontSize: 12 }}>
                {s(r, 'email')} · {n(r, 'bookings')} reservations. Their recorded bookings are
                listed below.
              </p>
              {data.bookings
                ?.filter((booking) => booking.user_id === r.id)
                .map((booking) => (
                  <div className="departure-item" key={s(booking, 'reference')}>
                    <div>
                      <strong>{s(booking, 'reference')}</strong>
                      <p>
                        {(booking.snapshot as Booking['snapshot']).title} ·{' '}
                        {label(s(booking, 'status'))}
                      </p>
                    </div>
                    <Link className="text-link" href={'/bookings/' + s(booking, 'reference')}>
                      View <ArrowUpRight size={15} />
                    </Link>
                  </div>
                ))}
            </div>
          </>
        )}
        {section === 'inquiries' && (
          <>
            <div className="span-2 detail-grid">
              <div>
                <small>Customer</small>
                {s(r, 'name')}
                <br />
                {s(r, 'email')}
                <br />
                {s(r, 'phone')}
              </div>
              <div>
                <small>Travel plans</small>
                {s(r, 'destination')}
                <br />
                {n(r, 'travelers')} travelers · {money(n(r, 'budget'))}
                <br />
                {date(s(r, 'start_date'))} – {date(s(r, 'end_date'))}
              </div>
              <div>
                <small>Accommodation & interests</small>
                <p>
                  {s(r, 'accommodation')}
                  <br />
                  {s(r, 'interests')}
                </p>
              </div>
              <div>
                <small>Special requests</small>
                <p>{s(r, 'requests') || 'None provided'}</p>
              </div>
            </div>
            {select(
              'status',
              'Inquiry status',
              ['NEW', 'IN_PROGRESS', 'QUOTED', 'CLOSED'].map((v) => [v, label(v)]),
            )}
            {input('amount', 'New quotation amount (PHP)', 'number', false, 0)}
            <div className="span-2">
              {area('message', 'Agency response / quotation details', '', false)}
            </div>
            <p className="span-2 muted" style={{ fontSize: 11 }}>
              Quotations require an amount and detailed response. Signed-in customers receive in-app
              updates. Coordinate guest inquiries using the customer’s contact details.
            </p>
            {((r.quotations as Row[]) || []).map((q, i) => (
              <div className="quotation span-2" key={i}>
                <strong>{money(n(q, 'amount'))}</strong>
                <p>{s(q, 'message')}</p>
              </div>
            ))}
          </>
        )}
        {section === 'reviews' && (
          <>
            <div className="span-2">
              <p>{s(r, 'body')}</p>
              <strong>
                {'★'.repeat(n(r, 'rating'))} · {s(r, 'name')}
              </strong>
            </div>
            {select('status', 'Moderation decision', [
              ['APPROVED', 'Approve'],
              ['REJECTED', 'Reject'],
            ])}
          </>
        )}
        {section === 'settings' && data.settings && (
          <>
            {input('brand', 'Agency name')}
            {input('tagline', 'Tagline', 'text', false)}
            {input('logo_url', 'Logo image URL (uploaded asset or Unsplash)', 'text', false)}
            {input('hero_image', 'Homepage banner image URL', 'text', false)}
            {input('email', 'Contact email', 'email', false)}
            {input('phone', 'Business phone', 'tel', false)}
            {area('address', 'Business address', undefined, false)}
            {input('whatsapp', 'WhatsApp HTTPS link', 'url', false)}
            {input('messenger', 'Messenger HTTPS link', 'url', false)}
            {input('instagram', 'Instagram HTTPS link', 'url', false)}
            {input('facebook', 'Facebook HTTPS link', 'url', false)}
            {Object.entries(data.settings.payment_instructions).map(([key, value]) => (
              <div key={key}>{area(key, `${label(key)} payment instructions`, value)}</div>
            ))}
          </>
        )}
        {section === 'staff' && (
          <>
            {input('name', 'Staff name')}
            {input('email', 'Email address', 'email')}
            <PasswordField
              label="Initial password (minimum 12 characters)"
              name="password"
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              required
            />
            <p className="muted" style={{ fontSize: 11 }}>
              Staff can manage travel operations. Only super administrators can change business
              settings or add staff.
            </p>
          </>
        )}
      </div>
      {['packages', 'destinations'].includes(section) && (
        <div className="upload-row">
          <Upload size={16} />
          <label>
            Upload a photo{' '}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
                e.target.value = '';
              }}
            />
          </label>
          <small className="muted">
            PNG, JPEG, WebP · maximum 2 MB · public package imagery only
          </small>
          <Message error={uploadError} />
        </div>
      )}
      <Message error={state.error} success={state.success} />
      <div className="form-actions">
        <small className="muted">Changes are recorded in the audit log.</small>
        <Submit busy={state.busy}>
          {section === 'staff' ? 'Create staff account' : 'Save changes'}
        </Submit>
      </div>
    </form>
  );
}
function ItineraryEditor({ row, onDone }: { row: Row; onDone: () => Promise<void> }) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [error, setError] = useState('');
  const state = useAction();
  useEffect(() => {
    api<Day[]>('packages/itinerary?package=' + s(row, 'id'))
      .then((items) => {
        setDays(
          Array.from(
            { length: n(row, 'duration') },
            (_, i) =>
              items[i] || {
                id: '',
                day: i + 1,
                title: '',
                activities: [
                  {
                    id: '',
                    time_label: '',
                    title: '',
                    description: '',
                    location: '',
                    included: true,
                  },
                ],
              },
          ),
        );
      })
      .catch((e) => setError(e.message));
  }, [row]);
  if (!days)
    return (
      <>
        <Message error={error} />
        <div className="loading">
          <LoaderCircle className="spin" />
          Loading itinerary…
        </div>
      </>
    );
  const update = (d: number, key: string, value: unknown) =>
    setDays((old) => old!.map((day, i) => (i === d ? { ...day, [key]: value } : day)));
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        state.run(async () => {
          await api('admin/itineraries', { package_id: row.id, days });
          await onDone();
        });
      }}
    >
      <p style={{ fontSize: 12 }}>
        One day per package day, in order. Optional activities are explicitly excluded from the base
        experience. Existing reservations keep their saved itinerary.
      </p>
      {days.map((d, i) => (
        <div className="itinerary-editor" key={i}>
          <h3>Day {i + 1}</h3>
          <Field label="Day title">
            <input
              value={d.title}
              required
              minLength={2}
              maxLength={200}
              onChange={(e) => update(i, 'title', e.target.value)}
            />
          </Field>
          {d.activities.map((a, j) => {
            const change = (key: string, value: unknown) =>
              update(
                i,
                'activities',
                d.activities.map((act, k) => (k === j ? { ...act, [key]: value } : act)),
              );
            return (
              <div className="activity-editor" key={j}>
                <div className="form-grid">
                  <Field label="Time / range">
                    <input
                      value={a.time_label}
                      maxLength={60}
                      onChange={(e) => change('time_label', e.target.value)}
                    />
                  </Field>
                  <Field label="Activity title">
                    <input
                      value={a.title}
                      required
                      minLength={2}
                      maxLength={200}
                      onChange={(e) => change('title', e.target.value)}
                    />
                  </Field>
                  <Field label="Description">
                    <textarea
                      value={a.description}
                      maxLength={2000}
                      onChange={(e) => change('description', e.target.value)}
                    />
                  </Field>
                  <Field label="Location">
                    <input
                      value={a.location}
                      maxLength={200}
                      onChange={(e) => change('location', e.target.value)}
                    />
                  </Field>
                  <Field label="Photo URL (optional)">
                    <input
                      value={a.photo_url || ''}
                      onChange={(e) => change('photo_url', e.target.value)}
                    />
                  </Field>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={a.included}
                      onChange={(e) => change('included', e.target.checked)}
                    />
                    Included in package price
                  </label>
                </div>
                {d.activities.length > 1 && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() =>
                      update(
                        i,
                        'activities',
                        d.activities.filter((_, k) => j !== k),
                      )
                    }
                  >
                    Remove activity
                  </button>
                )}
              </div>
            );
          })}
          <button
            type="button"
            className="btn secondary small"
            style={{ marginTop: 16 }}
            onClick={() =>
              update(i, 'activities', [
                ...d.activities,
                {
                  id: '',
                  time_label: '',
                  title: '',
                  description: '',
                  location: '',
                  included: true,
                },
              ])
            }
          >
            <Plus size={13} />
            Add activity
          </button>
        </div>
      ))}
      <Message error={state.error} />
      <Submit busy={state.busy}>Save itinerary</Submit>
    </form>
  );
}
