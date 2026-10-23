import 'dotenv/config';
import { getDB } from '../src/lib/db';
import { seed } from '../src/lib/seed';
const db = await getDB();
await seed(db);
console.log(
  'Fictional demonstration tours seeded. No customer accounts or payments were fabricated.',
);
await db.close();
