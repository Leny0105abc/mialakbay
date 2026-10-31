import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { staff, AppError, audit, rateLimit } from '@/lib/security';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    staff(user);
    if (req.headers.get('origin') !== new URL(process.env.APP_URL || req.url).origin)
      throw new AppError('Request origin could not be verified.', 403);
    const db = await getDB();
    await rateLimit(db, 'upload:' + user.id, 20, 300);
    const reader = req.body?.getReader();
    if (!reader) throw new AppError('Select an image.');
    let size = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2097152) {
        await reader.cancel();
        throw new AppError('Images must be 2 MB or smaller.', 413);
      }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    let mime = '';
    if (bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) mime = 'image/png';
    else if (bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex'))) mime = 'image/jpeg';
    else if (
      bytes.subarray(0, 4).toString() === 'RIFF' &&
      bytes.subarray(8, 12).toString() === 'WEBP'
    )
      mime = 'image/webp';
    if (!mime)
      throw new AppError(
        'Only PNG, JPEG, and WebP images are accepted. SVG files are not supported.',
      );
    const row = (
      await db.insertSQL<{ id: string }>(
        'INSERT INTO uploaded_assets(mime_type,bytes,uploaded_by) VALUES($1,$2,$3)',
        [mime, bytes, user.id],
      )
    ).rows[0];
    await audit(db, user, 'IMAGE_UPLOADED', 'asset', row.id);
    return NextResponse.json({ url: '/api/assets/' + row.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed.' },
      { status: e instanceof AppError ? e.status : 500 },
    );
  }
}
