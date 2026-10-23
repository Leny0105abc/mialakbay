import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
export const runtime = 'nodejs';
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!/^[a-z0-9-]{36}$/.test(id)) return new NextResponse(null, { status: 404 });
  const asset = (
    await (
      await getDB()
    ).query<{ mime_type: string; bytes: Uint8Array }>(
      'SELECT mime_type,bytes FROM uploaded_assets WHERE id=$1',
      [id],
    )
  ).rows[0];
  if (!asset) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(asset.bytes), {
    headers: {
      'Content-Type': asset.mime_type,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
