import 'dotenv/config';
import { getDB } from '../src/lib/db';
const db = await getDB({ migrate: true });
console.log('Database migrations applied.');
await db.close();
