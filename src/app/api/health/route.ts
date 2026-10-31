import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET() {
  try {
    const db = await getDB();
    await db.query('SELECT 1 AS ready');
    return NextResponse.json(
      { status: 'ok', database: 'mysql-compatible' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { status: 'unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
