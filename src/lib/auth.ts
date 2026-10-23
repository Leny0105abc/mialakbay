import { cookies } from 'next/headers';
import { getDB } from './db';
import { hashToken } from './security';
import type { User } from './types';
export const COOKIE = 'lakbay_session';
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};
export async function currentUser(): Promise<User | null> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return null;
  return (
    (
      await (
        await getDB()
      ).query<User>(
        'SELECT u.id,u.email,u.name,u.role,p.phone,p.address FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN customer_profiles p ON p.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()',
        [hashToken(value)],
      )
    ).rows[0] || null
  );
}
