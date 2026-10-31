import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { DB } from './db';
import type { User } from './types';
const scrypt = promisify(scryptCallback);
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export const hashToken = (s: string) => createHash('sha256').update(s).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export async function readJSON(
  request: Request,
  maxBytes = 200000,
): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('A request body is required.', 422);
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new AppError('This request is too large.', 413);
    }
    chunks.push(value);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body;
  } catch {
    throw new AppError('Provide a valid JSON object.', 422);
  }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function checkPassword(password: string, hash: string) {
  const [, salt, key] = hash.split(':');
  if (!salt || !key) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(key, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function staff(user: User | null): asserts user is User {
  if (!user) throw new AppError('Please sign in.', 401);
  if (!['SUPER_ADMIN', 'STAFF'].includes(user.role))
    throw new AppError('Staff access required.', 403);
}
export function signedIn(user: User | null): asserts user is User {
  if (!user) throw new AppError('Please sign in to continue.', 401);
}
export async function rateLimit(db: DB, key: string, limit = 10, windowSeconds = 900) {
  const count = await db.transaction(async (tx) => {
    await tx.query(
      'INSERT INTO rate_limits(`key`,count,reset_at) VALUES($1,1,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL $2 SECOND)) ON DUPLICATE KEY UPDATE count=IF(reset_at<UTC_TIMESTAMP(3),1,count+1),reset_at=IF(reset_at<UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL $2 SECOND),reset_at)',
      [key, windowSeconds],
    );
    return (
      await tx.query<{ count: number }>('SELECT count FROM rate_limits WHERE `key`=$1', [key])
    ).rows[0].count;
  });
  if (count > limit) throw new AppError('Too many attempts. Please try again later.', 429);
}
export async function audit(
  db: DB,
  user: User,
  action: string,
  type: string,
  id: string,
  detail: unknown = {},
) {
  await db.query(
    'INSERT INTO audit_logs(actor_id,action,entity_type,entity_id,detail) VALUES($1,$2,$3,$4,$5)',
    [user.id, action, type, id, JSON.stringify(detail)],
  );
}
