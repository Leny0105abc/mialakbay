import type { MetadataRoute } from 'next';
import { tours } from '@/lib/data';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL || 'http://localhost:3000';
  return [
    '',
    '/destinations',
    '/packages',
    '/services',
    '/custom-tour',
    '/about',
    '/contact',
    '/blog',
    '/faq',
    '/privacy',
    '/terms',
    '/cancellation',
    ...(await tours()).map((t) => '/packages/' + t.slug),
  ].map((p) => ({ url: base + p, changeFrequency: 'weekly', priority: p ? 0.7 : 1 }));
}
