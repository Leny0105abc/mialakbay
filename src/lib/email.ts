import type { DB } from './db';
// Transactional outbox: safe to retry. Resend deduplicates by notification ID.
export async function deliverEmails(db: DB) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) return { sent: 0, configured: false };
  const pending = (
    await db.query<{ id: string; email: string; title: string; message: string }>(
      `SELECT n.id,COALESCE(n.recipient_email,u.email,b.contact_email) email,n.title,n.message FROM notifications n LEFT JOIN users u ON u.id=n.user_id LEFT JOIN bookings b ON b.id=n.booking_id WHERE email_status IN ('PENDING','FAILED') AND COALESCE(n.recipient_email,u.email,b.contact_email) IS NOT NULL ORDER BY n.created_at LIMIT 20`,
    )
  ).rows;
  let sent = 0;
  for (const n of pending) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `lakbay-${n.id}`,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: [n.email],
          subject: n.title,
          text: n.message,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error('Email provider rejected the request.');
      await db.query("UPDATE notifications SET email_status='SENT' WHERE id=$1", [n.id]);
      sent++;
    } catch {
      await db.query("UPDATE notifications SET email_status='FAILED' WHERE id=$1", [n.id]);
    }
  }
  return { sent, configured: true };
}
