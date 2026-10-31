import type { DB } from './db';
import { getDB } from './db';
import type { Tour, Departure, Day, Settings, Inquiry, Promotion } from './types';
export const TOUR_SELECT =
  "SELECT p.*, (SELECT count(*) FROM bookings b JOIN departures s ON s.id=b.departure_id WHERE s.package_id=p.id AND b.status IN ('CONFIRMED','COMPLETED')) AS popularity, d.name AS destination,d.country,pr.adult_price,pr.child_price,pr.deposit_percent,COALESCE((SELECT url FROM package_images i WHERE i.package_id=p.id ORDER BY position LIMIT 1),d.image_url) AS image_url FROM packages p JOIN destinations d ON d.id=p.destination_id JOIN package_pricing pr ON pr.package_id=p.id";
export async function tours(includeDrafts = false, db?: DB) {
  return (
    await (db || (await getDB())).query<Tour>(
      TOUR_SELECT +
        (includeDrafts ? '' : " WHERE p.status='PUBLISHED'") +
        ' ORDER BY p.featured DESC,p.created_at',
    )
  ).rows;
}
export async function tour(slug: string, db?: DB) {
  return (
    await (db || (await getDB())).query<Tour>(
      TOUR_SELECT + " WHERE p.slug=$1 AND p.status='PUBLISHED'",
      [slug],
    )
  ).rows[0];
}
export async function departures(packageId?: string, db?: DB) {
  return (
    await (db || (await getDB())).query<Departure>(
      `SELECT s.*,p.title,p.slug FROM departures s JOIN packages p ON p.id=s.package_id WHERE p.status='PUBLISHED' AND s.departure_at>now() ${packageId ? 'AND s.package_id=$1' : ''} ORDER BY s.departure_at`,
      packageId ? [packageId] : [],
    )
  ).rows;
}
export async function itinerary(packageId: string, db?: DB) {
  const conn = db || (await getDB());
  const days = (
    await conn.query<Day>('SELECT * FROM itinerary_days WHERE package_id=$1 ORDER BY day', [
      packageId,
    ])
  ).rows;
  const activities = (
    await conn.query<Day['activities'][number] & { day_id: string }>(
      'SELECT a.* FROM itinerary_activities a JOIN itinerary_days d ON d.id=a.day_id WHERE d.package_id=$1 ORDER BY d.day,a.sequence',
      [packageId],
    )
  ).rows;
  return days.map((day) => ({ ...day, activities: activities.filter((a) => a.day_id === day.id) }));
}
export async function queryInquiries(db: DB, userId?: string) {
  const where = userId ? ' WHERE user_id=$1' : '';
  const rows = (
    await db.query<Inquiry & { user_id: string | null }>(
      'SELECT * FROM custom_inquiries' + where + ' ORDER BY created_at DESC',
      userId ? [userId] : [],
    )
  ).rows;
  const quotations = (
    await db.query<{
      id: string;
      inquiry_id: string;
      amount: number;
      message: string;
      created_at: string;
    }>(
      'SELECT q.* FROM inquiry_quotations q JOIN custom_inquiries i ON i.id=q.inquiry_id' +
        (userId ? ' WHERE i.user_id=$1' : '') +
        ' ORDER BY q.created_at DESC',
      userId ? [userId] : [],
    )
  ).rows;
  return {
    rows: rows.map((i) => ({ ...i, quotations: quotations.filter((q) => q.inquiry_id === i.id) })),
  };
}
export async function queryPromotions(db: DB) {
  const rows = (await db.query<Promotion>('SELECT * FROM promotions ORDER BY starts_at DESC')).rows;
  const eligibility = (
    await db.query<{ promotion_id: string; package_id: string }>('SELECT * FROM promotion_packages')
  ).rows;
  return {
    rows: rows.map((p) => ({
      ...p,
      package_ids: eligibility.filter((e) => e.promotion_id === p.id).map((e) => e.package_id),
    })),
  };
}
export const defaultSettings: Settings = {
  brand: 'Lakbay',
  tagline: 'Travel & Tours',
  logo_url: '',
  hero_image:
    'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=2400&q=90',
  email: '',
  phone: '',
  address: '',
  whatsapp: '',
  messenger: '',
  instagram: '',
  facebook: '',
  payment_instructions: {
    GCASH:
      'Payment collection is not configured. Contact the agency before transferring any funds.',
    MAYA: 'Payment collection is not configured. Contact the agency before transferring any funds.',
    BANK: 'Bank details are not configured. Contact the agency before transferring any funds.',
    CASH: 'Arrange an office appointment with the agency. Your reservation remains pending until staff records and verifies receipt.',
  },
};
export async function settings(db?: DB): Promise<Settings> {
  const row = (
    await (db || (await getDB())).query<{ value: Settings }>(
      "SELECT value FROM app_settings WHERE `key`='business'",
    )
  ).rows[0];
  return { ...defaultSettings, ...row?.value };
}
