import type { DB } from './db';
import { getDB } from './db';
import type { Tour, Departure, Day, Settings } from './types';
export const TOUR_SELECT = `SELECT p.*, (SELECT count(*)::int FROM bookings b JOIN departures s ON s.id=b.departure_id WHERE s.package_id=p.id AND b.status IN ('CONFIRMED','COMPLETED')) AS popularity, d.name AS destination,d.country,pr.adult_price,pr.child_price,pr.deposit_percent,COALESCE((SELECT url FROM package_images i WHERE i.package_id=p.id ORDER BY position LIMIT 1),d.image_url) AS image_url FROM packages p JOIN destinations d ON d.id=p.destination_id JOIN package_pricing pr ON pr.package_id=p.id`;
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
  return (
    await (db || (await getDB())).query<Day>(
      `SELECT d.*,COALESCE((SELECT jsonb_agg(a ORDER BY a.sequence) FROM itinerary_activities a WHERE a.day_id=d.id),'[]'::jsonb) AS activities FROM itinerary_days d WHERE package_id=$1 ORDER BY day`,
      [packageId],
    )
  ).rows;
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
      "SELECT value FROM app_settings WHERE key='business'",
    )
  ).rows[0];
  return { ...defaultSettings, ...row?.value };
}
