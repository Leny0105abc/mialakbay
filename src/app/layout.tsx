import type { Metadata } from 'next';
import { Header, Footer } from '@/components/shell';
import { currentUser } from '@/lib/auth';
import { settings } from '@/lib/data';
import './globals.css';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'http://localhost:3000'),
  title: {
    default: 'Lakbay Travel & Tours · Find your next adventure',
    template: '%s | Lakbay Travel & Tours',
  },
  description:
    'Thoughtfully planned island escapes, cultural discoveries, and custom journeys across the Philippines and beyond. Explore packages and manage your reservations.',
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, business] = await Promise.all([currentUser(), settings()]);
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        <Header user={user} settings={business} demo={process.env.DEMO_MODE !== 'false'} />
        <main id="main-content">{children}</main>
        <Footer settings={business} />
      </body>
    </html>
  );
}
