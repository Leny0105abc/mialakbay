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
      "SELECT (SELECT count(*) FROM bookings) bookings,(SELECT count(*) FROM bookings WHERE status IN ('PENDING_REVIEW','PENDING_PAYMENT','PAYMENT_UNDER_REVIEW')) pending,(SELECT count(*) FROM bookings WHERE status='CONFIRMED') confirmed,(SELECT count(*) FROM users WHERE role='CUSTOMER') customers,(SELECT count(*) FROM packages WHERE status='PUBLISHED') packages,(SELECT count(*) FROM departures WHERE departure_at>now() AND available) departures,(SELECT count(*) FROM payments WHERE kind='PAYMENT') payments,(SELECT COALESCE(sum(CASE WHEN kind='PAYMENT' THEN amount ELSE -amount END),0) FROM payments) revenue,(SELECT count(*) FROM custom_inquiries WHERE status!='CLOSED') inquiries",
    )
  ).rows[0];

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  }).format(new Date());
  const [year, month] = today.split('-').map(Number);
  const months = Array.from(
    { length: 6 },
    (_, i) => new Date(Date.UTC(year, month - 1 - 5 + i, 1) - 8 * 3600000),
  );
  const start = months[0];
  const end = new Date(Date.UTC(year, month, 1) - 8 * 3600000);
  const [bookings, payments] = await Promise.all([
    db.query<{ month_key: string; bookings: number }>(
      "SELECT DATE_FORMAT(DATE_ADD(created_at,INTERVAL 8 HOUR),'%Y-%m') AS month_key,COUNT(*) AS bookings FROM bookings WHERE created_at>=$1 AND created_at<$2 GROUP BY month_key",
      [start, end],
    ),
    db.query<{ month_key: string; revenue: string }>(
      "SELECT DATE_FORMAT(DATE_ADD(paid_at,INTERVAL 8 HOUR),'%Y-%m') AS month_key,COALESCE(SUM(CASE WHEN kind='PAYMENT' THEN amount ELSE -amount END),0) AS revenue FROM payments WHERE paid_at>=$1 AND paid_at<$2 GROUP BY month_key",
      [start, end],
    ),
  ]);
  const monthly = months.map((m) => {
    const shifted = new Date(m.getTime() + 8 * 3600000);
    const key = shifted.toISOString().slice(0, 7);
    return {
      month: new Intl.DateTimeFormat('en-PH', {
        timeZone: 'Asia/Manila',
        month: 'short',
        year: '2-digit',
      }).format(m),
      bookings: Number(bookings.rows.find((r) => r.month_key === key)?.bookings || 0),
      revenue: payments.rows.find((r) => r.month_key === key)?.revenue || '0',
    };
  });
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
