import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { getDB } from '../src/lib/db';
// Accept only a trusted export of this application's normalized tables.
const order = [
  'roles',
  'users',
  'customer_profiles',
  'destinations',
  'packages',
  'package_images',
  'package_pricing',
  'itinerary_days',
  'itinerary_activities',
  'departures',
  'promotions',
  'promotion_packages',
  'bookings',
  'booking_travelers',
  'promotion_usage',
  'payment_submissions',
  'payments',
  'custom_inquiries',
  'inquiry_quotations',
  'reviews',
  'notifications',
  'website_content',
  'app_settings',
  'audit_logs',
  'uploaded_assets',
];
const source = process.argv[2];
if (!source) throw new Error('Usage: npm run db:import -- /private/path/export.json');
const records = JSON.parse(await readFile(source, 'utf8')) as Record<
  string,
  Record<string, unknown>[]
>;
const db = await getDB();
try {
  if (
    (await db.query('SELECT id FROM packages LIMIT 1')).rows.length ||
    (await db.query('SELECT id FROM users LIMIT 1')).rows.length
  )
    throw new Error('Import requires an empty application database. No records were overwritten.');
  await db.transaction(async (tx) => {
    for (const table of order) {
      if (table === 'roles') continue;
      const rows = records[table] || [];
      for (const row of rows) {
        const keys = Object.keys(row);
        if (keys.some((k) => !/^\w+$/.test(k))) throw new Error('Invalid export column.');
        const values = Object.values(row).map((v) =>
          v && typeof v === 'object' && '__binary' in v
            ? Buffer.from(String(v.__binary), 'base64')
            : v,
        );
        await tx.query(
          'INSERT INTO `' +
            table +
            '` (' +
            keys.map((k) => '`' + k + '`').join(',') +
            ') VALUES (' +
            keys.map((_, i) => '$' + (i + 1)).join(',') +
            ')',
          values,
        );
      }
      console.log(table + ': ' + rows.length + ' records imported');
    }
  });
} finally {
  await db.close();
}
