import 'dotenv/config';
import { getDB } from '../src/lib/db';
import { hashPassword } from '../src/lib/security';
import { z } from 'zod';
const input = z
  .object({ email: z.email(), password: z.string().min(12), name: z.string().min(2) })
  .parse({
    email: process.env.ADMIN_EMAIL?.toLowerCase(),
    password: process.env.ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME || 'Agency Administrator',
  });
const db = await getDB();
const exists = await db.query('SELECT id FROM users WHERE email=$1', [input.email]);
if (exists.rows.length)
  throw new Error('An account already uses this email. No existing account was modified.');
const u = await db.insertSQL<{ id: string }>(
  "INSERT INTO users(email,name,password_hash,role) VALUES($1,$2,$3,'SUPER_ADMIN')",
  [input.email, input.name, await hashPassword(input.password)],
);
await db.query('INSERT INTO customer_profiles(user_id) VALUES($1)', [u.rows[0].id]);
console.log('Administrator created. Sign in at /admin/login.');
await db.close();
