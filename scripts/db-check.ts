import 'dotenv/config';
import { getDB } from '../src/lib/db';
const db = await getDB();
try {
  const result = (
    await db.query<{ version: string; timezone: string; tables: number }>(
      'SELECT VERSION() AS version,@@session.time_zone AS timezone,(SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()) AS tables',
    )
  ).rows[0];
  console.log({
    databaseEngine: result.version,
    sessionTimezone: result.timezone,
    tables: result.tables,
  });
} finally {
  await db.close();
}
