import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  MapPin,
  Clock,
  Users,
  Bus,
  Hotel,
  Utensils,
  UserRound,
  ArrowUpRight,
  Plane,
  Building2,
  Car,
  GraduationCap,
  HeartHandshake,
  Mail,
  Phone,
} from 'lucide-react';
import { getDB } from '@/lib/db';
import { currentUser } from '@/lib/auth';
import { tours, tour, departures, itinerary, settings } from '@/lib/data';
import { expireHolds } from '@/lib/booking';
import { Timeline, Inclusions } from '@/components/tours';
import Explorer from '@/components/explorer';
import BookingWidget from '@/components/booking-widget';
import Calendar from '@/components/calendar';
import Checkout from '@/components/checkout';
import BookingDetail from '@/components/booking-detail';
import { AuthForm, InquiryForm, LookupForm } from '@/components/forms';
type Props = {
  params: Promise<{ slug: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const titles: Record<string, string> = {
  checkout: 'Reserve your experience',
  bookings: 'Your reservation',
  login: 'Sign in',
  register: 'Create an account',
  destinations: 'Find your somewhere.',
  packages: 'Good places. Great possibilities.',
  calendar: 'Make time for an adventure.',
  services: 'A little help goes a long way.',
  'custom-tour': 'A journey that’s entirely yours.',
  about: 'Thoughtful journeys. Meaningful memories.',
  contact: 'Let’s talk about your next adventure.',
  blog: 'Notes for the road.',
  faq: 'Before you pack your bags.',
  privacy: 'Privacy notice',
  terms: 'Booking terms',
  cancellation: 'Cancellation & refunds',
  lookup: 'Let’s find your reservation.',
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (slug[0] === 'packages' && slug[1]) {
    const t = await tour(slug[1]);
    return { title: t?.title || 'Package not found', description: t?.description };
  }
  return {
    title: titles[slug[0]] || slug[0].replaceAll('-', ' '),
    ...(['checkout', 'bookings', 'lookup', 'login', 'register'].includes(slug[0])
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}
function Banner({
  title,
  eyebrow = 'FIND YOUR KIND OF ADVENTURE',
  description,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
}) {
  return (
    <section className="page-banner">
      <div className="container">
        <div className="breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <span>
            {eyebrow === 'FIND YOUR KIND OF ADVENTURE' ? 'Explore' : eyebrow.toLowerCase()}
          </span>
        </div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
    </section>
  );
}
const serialize = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
export default async function PublicPage(props: Props) {
  const { slug } = await props.params;
  const search = await props.searchParams;
  const root = slug[0];
  const db = await getDB();
  if (root === 'login' || root === 'register')
    return (
      <Suspense>
        <AuthForm register={root === 'register'} />
      </Suspense>
    );
  if (root === 'bookings' && slug[1])
    return <BookingDetail reference={slug[1]} user={await currentUser()} />;
  if (root === 'packages' && slug[1]) {
    const p = await tour(slug[1], db);
    if (!p) notFound();
    await expireHolds(db);
    const [dates, days, images, reviews] = await Promise.all([
      departures(p.id, db),
      itinerary(p.id, db),
      db.query<{ url: string; alt: string }>(
        'SELECT url,alt FROM package_images WHERE package_id=$1 ORDER BY position',
        [p.id],
      ),
      db.query<{ name: string; rating: number; body: string; created_at: string }>(
        "SELECT u.name,r.rating,r.body,r.created_at FROM reviews r JOIN users u ON u.id=r.user_id WHERE package_id=$1 AND status='APPROVED' ORDER BY r.created_at DESC",
        [p.id],
      ),
    ]);
    return (
      <div className="container package-intro">
        <div className="breadcrumb">
          <Link href="/">Home</Link>
          <span>/</span>
          <Link href="/packages">Experiences</Link>
          <span>/</span>
          <span>{p.destination}</span>
        </div>
        <div className="package-heading">
          <div>
            <span className="eyebrow">{p.category.toUpperCase()}</span>
            <h1>{p.title}</h1>
            <div className="package-meta">
              <span>
                <MapPin size={14} />
                {p.destination}
              </span>
              <span>
                <Clock size={14} />
                {p.duration} days / {p.duration - 1} nights
              </span>
              <span>
                <Users size={14} />
                {p.min_participants}–{p.max_participants} travelers
              </span>
            </div>
          </div>
          <Link
            href={`/custom-tour?destination=${encodeURIComponent(p.destination)}`}
            className="btn secondary"
          >
            Ask about this trip <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="package-gallery">
          {images.rows.map((img, i) => (
            <img key={i} src={img.url} alt={img.alt} loading={i ? 'lazy' : 'eager'} />
          ))}
        </div>
        {p.demo && (
          <div className="notice">
            Fictional demonstration package. All prices, itineraries, accommodations, and departure
            dates are sample data for testing. Photos are illustrative. No actual travel
            availability is claimed.
          </div>
        )}
        <div className="package-body">
          <div className="package-main">
            <section>
              <span className="eyebrow">A LITTLE ABOUT THE EXPERIENCE</span>
              <h2>Go somewhere. Feel something.</h2>
              <p>{p.description}</p>
              <div className="package-facts">
                {[
                  [Bus, 'Getting around', p.transportation],
                  [Hotel, 'Your home away from home', p.accommodation],
                  [Utensils, 'At the table', p.meals],
                  [UserRound, 'Your local guide', p.guide],
                ].map(([Icon, title, text]) => {
                  const I = Icon as typeof Bus;
                  return (
                    <div className="fact" key={String(title)}>
                      <I size={21} />
                      <div>
                        <strong>{String(title)}</strong>
                        <p>{String(text)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
            <section>
              <span className="eyebrow">ONE GOOD DAY AFTER ANOTHER</span>
              <h2>Your journey, day by day.</h2>
              {days.length ? (
                <Timeline days={serialize(days)} />
              ) : (
                <p>
                  The agency is preparing this itinerary. Ask our team for details before reserving.
                </p>
              )}
            </section>
            <section>
              <h2>The little details, all laid out.</h2>
              <div className="inclusions-grid">
                <div>
                  <h4>Included in your experience</h4>
                  <Inclusions items={p.inclusions} />
                </div>
                <div>
                  <h4>Not included / optional</h4>
                  <ul className="exclusions">
                    {p.exclusions.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
            <section>
              <h2>A few things before you go.</h2>
              <p>
                <strong>Meeting location:</strong> {p.meeting_point}
              </p>
              <p style={{ whiteSpace: 'pre-line' }}>{p.policies}</p>
              {p.notes && <p>{p.notes}</p>}
              <Link className="text-link" href="/cancellation">
                Cancellation policy <ArrowUpRight size={14} />
              </Link>
            </section>
            <section>
              <h2>Stories from this experience.</h2>
              {reviews.rows.length ? (
                reviews.rows.map((r, i) => (
                  <article className="review-card" key={i} style={{ marginBottom: 15 }}>
                    <span className="stars" aria-label={`${r.rating} stars`}>
                      {'★'.repeat(r.rating)}
                    </span>
                    <p>{r.body}</p>
                    <strong>{r.name}</strong>
                    <small>Verified completed booking</small>
                  </article>
                ))
              ) : (
                <p>
                  No approved reviews yet. Reviews are accepted only from customers with completed
                  bookings.
                </p>
              )}
            </section>
          </div>
          <BookingWidget tour={serialize(p)} departures={serialize(dates)} />
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'TouristTrip',
              name: p.title,
              description: p.description,
              touristType: p.category,
              itinerary: days.map((d) => ({ '@type': 'ListItem', position: d.day, name: d.title })),
            }).replaceAll('<', '\u003c'),
          }}
        />
      </div>
    );
  }
  if (root === 'packages') {
    await expireHolds(db);
    const [packages, dates] = await Promise.all([tours(false, db), departures(undefined, db)]);
    return (
      <>
        <Banner
          title={titles.packages}
          description="Island time, mountain air, or a city you’ve never met. Find a journey that feels like you."
        />
        <div className="container page-content">
          <Suspense fallback={<p>Finding experiences…</p>}>
            <Explorer tours={serialize(packages)} departures={serialize(dates)} />
          </Suspense>
        </div>
      </>
    );
  }
  if (root === 'destinations') {
    const all = (
      await db.query<{
        id: string;
        name: string;
        country: string;
        description: string;
        image_url: string;
      }>('SELECT * FROM destinations ORDER BY name')
    ).rows;
    return (
      <>
        <Banner
          title={titles.destinations}
          description="From the islands we call home to places you’ve only dreamed of. There’s a whole world waiting."
        />
        <div className="container page-content">
          <div className="destination-grid">
            {all.map((d) => (
              <Link
                className="destination-card"
                href={`/packages?q=${encodeURIComponent(d.name)}`}
                key={d.id}
              >
                <img src={d.image_url} alt={`Illustrative scenery for ${d.name}`} loading="lazy" />
                <span className="destination-label">{d.country.toUpperCase()}</span>
                <div>
                  <span>
                    <h3>{d.name}</h3>
                    <small>Discover the experience</small>
                  </span>
                  <span className="circle-arrow">
                    <ArrowUpRight size={19} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </>
    );
  }
  if (root === 'calendar') {
    await expireHolds(db);
    return (
      <>
        <Banner
          title={titles.calendar}
          description="Find your dates and check available seats. All times are in Asia/Manila."
        />
        <div className="container page-content">
          <Calendar
            tours={serialize(await tours(false, db))}
            departures={serialize(await departures(undefined, db))}
          />
        </div>
      </>
    );
  }
  if (root === 'checkout') {
    const pkg = typeof search.package === 'string' ? await tour(search.package, db) : undefined;
    if (!pkg)
      return (
        <>
          <Banner title="First, find your kind of adventure." />
          <div className="container page-content">
            <Link href="/packages" className="btn primary">
              Explore tour packages
            </Link>
          </div>
        </>
      );
    await expireHolds(db);
    const dates = await departures(pkg.id, db);
    return (
      <>
        <Banner
          title="A few details. A great adventure."
          eyebrow="YOUR RESERVATION"
          description="You’re a few thoughtful steps away from somewhere new."
        />
        <Checkout
          tour={serialize(pkg)}
          departures={serialize(dates)}
          settings={await settings(db)}
          user={await currentUser()}
          initialDeparture={
            typeof search.departure === 'string' ? search.departure : dates[0]?.id || ''
          }
          initialAdults={Math.min(pkg.max_participants, Math.max(1, Number(search.adults) || 1))}
          initialChildren={Math.min(
            pkg.max_participants - 1,
            Math.max(0, Number(search.children) || 0),
          )}
        />
      </>
    );
  }
  if (root === 'custom-tour' || root === 'contact') {
    const business = await settings(db);
    return (
      <>
        <Banner
          title={titles[root]}
          eyebrow={root === 'contact' ? 'SAY HELLO' : 'YOUR DREAM. OUR LITTLE DETAILS.'}
          description={
            root === 'contact'
              ? 'A question, an idea, a destination on your mind. We’d love to hear it.'
              : 'Tell us a little about your people, your places, and your perfect kind of day.'
          }
        />
        <div className="container page-content contact-layout">
          <div className="contact-info">
            <h2>
              {root === 'contact'
                ? 'Good conversations lead to great journeys.'
                : 'Start with a little daydream.'}
            </h2>
            <p>
              Share what you have in mind and the agency can prepare a tailored response. Travel and
              assistance services are inquiry-based until a specific quotation is agreed.
            </p>
            {business.email && (
              <div className="contact-item">
                <Mail size={19} />
                <div>
                  <strong>Drop us a note</strong>
                  <a href={`mailto:${business.email}`}>{business.email}</a>
                </div>
              </div>
            )}
            {business.phone && (
              <div className="contact-item">
                <Phone size={19} />
                <div>
                  <strong>Give us a call</strong>
                  <a href={`tel:${business.phone}`}>{business.phone}</a>
                </div>
              </div>
            )}
            {business.address && (
              <div className="contact-item">
                <MapPin size={19} />
                <div>
                  <strong>Find us here</strong>
                  <p>{business.address}</p>
                </div>
              </div>
            )}
            {!business.email && !business.phone && (
              <div className="notice" style={{ marginTop: 25 }}>
                Direct contact details have not been configured. Your inquiry will be recorded for
                staff to review in the agency portal.
              </div>
            )}
            {business.whatsapp && (
              <a
                className="btn secondary"
                style={{ marginTop: 20 }}
                href={business.whatsapp}
                target="_blank"
                rel="noreferrer"
              >
                Chat on WhatsApp <ArrowUpRight size={16} />
              </a>
            )}
            {business.messenger && (
              <a
                className="btn secondary"
                style={{ marginTop: 12 }}
                href={business.messenger}
                target="_blank"
                rel="noreferrer"
              >
                Open Messenger <ArrowUpRight size={16} />
              </a>
            )}
            <p style={{ fontSize: 11, marginTop: 25 }}>
              No live flight inventory, visa approval, accreditation, or government authorization is
              implied by this demonstration application.
            </p>
          </div>
          <div className="panel">
            <Suspense>
              <InquiryForm user={await currentUser()} compact={root === 'contact'} />
            </Suspense>
          </div>
        </div>
      </>
    );
  }
  if (root === 'services') {
    const services = [
      [
        CompassIcon,
        'Domestic travel arrangements',
        'From island escapes to weekend discoveries, find your next chapter closer to home.',
      ],
      [
        Plane,
        'International tours',
        'Explore beyond the familiar with a considered itinerary and local arrangements.',
      ],
      [
        Building2,
        'Hotel reservation assistance',
        'Find a comfortable place to call home, wherever you’re headed.',
      ],
      [
        Plane,
        'Airline booking assistance',
        'Request help with flight options. Availability and fares require a separate confirmation.',
      ],
      [
        Car,
        'Transportation & van rental',
        'Keep your group moving with transportation suited to your itinerary.',
      ],
      [
        Users,
        'Group & company outings',
        'Shared adventures for team days, reunions, and milestones.',
      ],
      [
        GraduationCap,
        'School & educational tours',
        'Learning beyond the classroom, with itineraries shaped around your group.',
      ],
      [
        HeartHandshake,
        'Passport & visa assistance',
        'Inquiry-based document guidance. Decisions are made by the relevant authorities; approval is never guaranteed.',
      ],
    ];
    return (
      <>
        <Banner
          title={titles.services}
          description="Thoughtful support for all the moving parts of your journey. Tell us what you need."
        />
        <div className="container page-content">
          <div className="notice">
            All services below are inquiry-based. No flight, hotel, or visa transaction is completed
            through a direct provider integration.
          </div>
          <div className="service-grid">
            {services.map(([Icon, title, body]) => {
              const I = Icon as typeof Plane;
              return (
                <article className="service-card" key={String(title)}>
                  <I size={27} strokeWidth={1.5} />
                  <small>INQUIRY-BASED ASSISTANCE</small>
                  <h3>{String(title)}</h3>
                  <p>{String(body)}</p>
                  <Link
                    href={`/custom-tour?destination=${encodeURIComponent(String(title))}`}
                    className="text-link"
                  >
                    Let’s talk <ArrowUpRight size={16} />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </>
    );
  }
  if (root === 'lookup')
    return (
      <>
        <Banner
          title={titles.lookup}
          eyebrow="GUEST RESERVATIONS"
          description="A booking reference, your email, and the private key from your confirmation are all you need."
        />
        <div className="container page-content" style={{ maxWidth: 560 }}>
          <div className="panel">
            <LookupForm />
          </div>
        </div>
      </>
    );
  if (root === 'blog') {
    if (slug[1]) {
      const c = (
        await db.query<{ title: string; body: string }>(
          'SELECT * FROM website_content WHERE key=$1',
          ['blog-' + slug[1]],
        )
      ).rows[0];
      if (!c) notFound();
      return (
        <>
          <Banner title={c.title} eyebrow="THE TRAVEL JOURNAL" />
          <article className="container page-content narrow prose">
            <p>{c.body}</p>
            <Link className="text-link" href="/blog">
              Back to the journal
            </Link>
          </article>
        </>
      );
    }
    const articles = (
      await db.query<{ key: string; title: string; body: string }>(
        "SELECT * FROM website_content WHERE key LIKE 'blog-%' ORDER BY key",
      )
    ).rows;
    return (
      <>
        <Banner
          title={titles.blog}
          eyebrow="THE TRAVEL JOURNAL"
          description="A little inspiration, a few useful details, and a whole lot of places to go."
        />
        <div className="container page-content">
          <div className="journal-grid">
            {articles.map((a, i) => (
              <Link
                href={`/blog/${a.key.replace('blog-', '')}`}
                className="journal-card"
                key={a.key}
              >
                <img
                  src={`https://images.unsplash.com/${i ? 'photo-1476514525535-07fb3b4ae5f1' : 'photo-1502680390469-be75c86b636f'}?auto=format&fit=crop&w=900&q=80`}
                  alt="Travel inspiration"
                />
                <div>
                  <span className="eyebrow">TRAVEL WELL · 3 MIN READ</span>
                  <h3>{a.title}</h3>
                  <span className="text-link">
                    Read the story <ArrowUpRight size={14} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </>
    );
  }
  if (['about', 'faq', 'privacy', 'terms', 'cancellation'].includes(root)) {
    const c = (
      await db.query<{ title: string; body: string }>(
        'SELECT * FROM website_content WHERE key=$1',
        [root],
      )
    ).rows[0];
    if (!c) notFound();
    return (
      <>
        <Banner
          title={c.title}
          eyebrow={
            root === 'about'
              ? 'THE LAKBAY WAY'
              : root === 'faq'
                ? 'GOOD QUESTIONS. GREAT TRIPS.'
                : 'A LITTLE CLARITY FOR THE JOURNEY'
          }
        />
        <article className="container page-content narrow prose">
          {root === 'faq' ? (
            <div className="faqs">
              {c.body.split('\n').map((s, i) => {
                const [q, a] = s.split('|');
                return (
                  <details key={i}>
                    <summary>
                      {q}
                      <span>+</span>
                    </summary>
                    <p>{a}</p>
                  </details>
                );
              })}
            </div>
          ) : (
            <p>{c.body}</p>
          )}
          <Link className="btn primary" href={root === 'about' ? '/packages' : '/contact'}>
            {root === 'about' ? 'Find your next adventure' : 'Talk to our team'}
            <ArrowUpRight size={16} />
          </Link>
        </article>
      </>
    );
  }
  notFound();
}
function CompassIcon(props: React.ComponentProps<typeof MapPin>) {
  return <MapPin {...props} />;
}
