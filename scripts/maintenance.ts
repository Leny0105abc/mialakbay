import 'dotenv/config';
import { getDB } from '../src/lib/db';
import { expireHolds, notify } from '../src/lib/booking';
import { deliverEmails } from '../src/lib/email';
const db = await getDB();
await expireHolds(db);
await db.transaction(async (tx) => {
  const upcoming = (
    await tx.query<{ id: string; user_id: string; reference: string }>(
      `SELECT b.id,b.user_id,b.reference FROM bookings b JOIN departures d ON d.id=b.departure_id WHERE b.status='CONFIRMED' AND d.departure_at BETWEEN now() AND now()+interval '3 days' AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.booking_id=b.id AND n.title='Your trip is coming up') FOR UPDATE OF b`,
    )
  ).rows;
  for (const b of upcoming)
    await notify(
      tx,
      b.user_id,
      b.id,
      'Your trip is coming up',
      `${b.reference}: your trip departs within three days. Check your itinerary and meeting details.`,
    );
});
await db.query('DELETE FROM sessions WHERE expires_at<now()');
await db.query('DELETE FROM rate_limits WHERE reset_at<now()');
console.log(await deliverEmails(db));
await db.close();
