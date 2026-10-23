import type { DB } from './db';
export async function reports(db: DB) {
  const stats = (
    await db.query<{
      bookings: number;
      pending: number;
      confirmed: number;
      customers: number;
      packages: number;
      departures: number;
      payments: number;
      revenue: string;
      inquiries: number;
    }>(
      `SELECT (SELECT count(*)::int FROM bookings) bookings,(SELECT count(*)::int FROM bookings WHERE status IN ('PENDING_REVIEW','PENDING_PAYMENT','PAYMENT_UNDER_REVIEW')) pending,(SELECT count(*)::int FROM bookings WHERE status='CONFIRMED') confirmed,(SELECT count(*)::int FROM users WHERE role='CUSTOMER') customers,(SELECT count(*)::int FROM packages WHERE status='PUBLISHED') packages,(SELECT count(*)::int FROM departures WHERE departure_at>now() AND available) departures,(SELECT count(*)::int FROM payments WHERE kind='PAYMENT') payments,(SELECT COALESCE(sum(CASE WHEN kind='PAYMENT' THEN amount ELSE -amount END),0)::text FROM payments) revenue,(SELECT count(*)::int FROM custom_inquiries WHERE status!='CLOSED') inquiries`,
    )
  ).rows[0];
  const monthly = (
    await db.query<{ month: string; bookings: number; revenue: string }>(
      `WITH months AS (SELECT generate_series(date_trunc('month',now() AT TIME ZONE 'Asia/Manila')-interval '5 months',date_trunc('month',now() AT TIME ZONE 'Asia/Manila'),interval '1 month') AS m) SELECT to_char(m,'Mon YY') AS "month",(SELECT count(*)::int FROM bookings b WHERE b.created_at>=(m AT TIME ZONE 'Asia/Manila') AND b.created_at<((m+interval '1 month') AT TIME ZONE 'Asia/Manila')) AS bookings,(SELECT COALESCE(sum(CASE WHEN kind='PAYMENT' THEN amount ELSE -amount END),0)::text FROM payments p WHERE p.paid_at>=(m AT TIME ZONE 'Asia/Manila') AND p.paid_at<((m+interval '1 month') AT TIME ZONE 'Asia/Manila')) AS revenue FROM months`,
    )
  ).rows;
  return {
    stats: { ...stats, revenue: Number(stats.revenue) },
    monthly: monthly.map((m) => ({ ...m, revenue: Number(m.revenue) / 100 })),
  };
}
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return 'No recorded reservations\r\n';
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return [
    keys.map(escape).join(','),
    ...rows.map((r) => keys.map((k) => escape(r[k])).join(',')),
  ].join('\r\n');
}
