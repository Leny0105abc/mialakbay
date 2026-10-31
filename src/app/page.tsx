import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  MapPin,
  CalendarDays,
  Users,
  Search,
  Compass,
  Route,
  HeartHandshake,
  ShieldCheck,
  MoveUpRight,
  Sun,
  Check,
} from 'lucide-react';
import { tours, settings } from '@/lib/data';
import { getDB } from '@/lib/db';
import { TourCard, SectionHeading } from '@/components/tours';
import { money } from '@/lib/format';
type Content = { key: string; title: string; body: string };
export default async function Home() {
  const db = await getDB();
  const business = await settings(db);
  const [packages, destinations, contents, promos, reviews] = await Promise.all([
    tours(false, db),
    db.query<{ id: string; name: string; image_url: string; country: string; packages: number }>(
      "SELECT d.*,(SELECT count(*) FROM packages p WHERE p.destination_id=d.id AND p.status='PUBLISHED') packages FROM destinations d WHERE featured ORDER BY name LIMIT 4",
    ),
    db.query<Content>('SELECT * FROM website_content'),
    db.query<{
      name: string;
      code: string;
      discount_type: string;
      value: number;
      min_total: number;
    }>(
      'SELECT * FROM promotions WHERE active AND starts_at<=now() AND ends_at>now() AND used<usage_limit ORDER BY starts_at LIMIT 1',
    ),
    db.query<{ id: string; name: string; body: string; rating: number; title: string }>(
      "SELECT r.id,u.name,r.body,r.rating,p.title FROM reviews r JOIN users u ON u.id=r.user_id JOIN packages p ON p.id=r.package_id WHERE r.status='APPROVED' ORDER BY r.created_at DESC LIMIT 3",
    ),
  ]);
  const content = Object.fromEntries(contents.rows.map((c) => [c.key, c]));
  const promo = promos.rows[0];
  const featured = packages.filter((p) => p.featured).slice(0, 3);
  const budget = [...packages].sort((a, b) => a.adult_price - b.adult_price).slice(0, 3);
  return (
    <>
      <section className="hero">
        <img
          className="hero-img"
          src={
            business.hero_image ||
            'https://images.unsplash.com/photo-1518509562904-e7ef99cdcc86?auto=format&fit=crop&w=2400&q=90'
          }
          alt="Turquoise water and dramatic island scenery in the Philippines"
          fetchPriority="high"
        />
        <div className="hero-overlay" />
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="hero-kicker">
              <span /> A LITTLE WANDERLUST GOES A LONG WAY
            </span>
            <h1>{content.home?.title || 'Discover Your Next Adventure.'}</h1>
            <p>{content.home?.body}</p>
            <Link className="btn ivory" href="/packages">
              Find your kind of escape <ArrowUpRight size={19} />
            </Link>
            <div className="hero-trust">
              <span className="trust-icon">
                <Compass size={22} />
              </span>
              <span>
                Less planning. More living.<small>We’ll take care of the little details.</small>
              </span>
            </div>
          </div>
          <div className="hero-coordinate">
            <span className="coordinate-icon">
              <MapPin size={17} />
            </span>
            <div>
              Somewhere you’d rather be.<strong>EL NIDO, PALAWAN</strong>
            </div>
          </div>
          <div className="hero-bottom">
            <span>
              SCROLL TO EXPLORE <span>↓</span>
            </span>
            <span>7,641 islands. Endless possibilities.</span>
            <div className="hero-page">
              <b>01</b>
              <span />
              03
            </div>
          </div>
        </div>
      </section>
      <div className="container search-holder">
        <form className="home-search" action="/packages">
          <div className="search-intro">
            <Search size={20} />
            <span>Where to next?</span>
          </div>
          <label>
            <MapPin size={19} />
            <span>
              Destination
              <input
                name="q"
                placeholder="Where do you want to go?"
                aria-label="Destination or package"
              />
            </span>
          </label>
          <label>
            <CalendarDays size={19} />
            <span>
              Travel date
              <input name="date" type="date" aria-label="Travel date" />
            </span>
          </label>
          <label>
            <Users size={19} />
            <span>
              Travelers
              <select name="travelers" aria-label="Number of travelers">
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'traveler' : 'travelers'}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <button className="btn primary" type="submit">
            Find my trip <ArrowUpRight size={18} />
          </button>
        </form>
      </div>
      <div className="container reassurance">
        <span>
          <Check size={16} /> Thoughtfully curated experiences
        </span>
        <span>
          <Check size={16} /> Clear, upfront package pricing
        </span>
        <span>
          <Check size={16} /> A real team, here to help
        </span>
        <span className="reassurance-last">
          <Sun size={18} /> A good time to get away
        </span>
      </div>
      <section className="section container destinations-section">
        <SectionHeading
          eyebrow="THE WORLD IS CALLING"
          title="A place for every kind of you."
          description="Chase the sun, find a new perspective, or just get a little lost."
          href="/destinations"
          link="All destinations"
        />
        <div className="destination-grid">
          {destinations.rows.map((d, i) => (
            <Link
              href={`/packages?q=${encodeURIComponent(d.name)}`}
              className={`destination-card destination-${i}`}
              key={d.id}
            >
              <img src={d.image_url} alt={`Illustrative scenery for ${d.name}`} loading="lazy" />
              <span className="destination-label">
                {d.country === 'Philippines' ? 'PHILIPPINES' : d.country.toUpperCase()}
              </span>
              <div>
                <span>
                  <h3>{d.name}</h3>
                  <small>
                    {d.packages} {d.packages === 1 ? 'experience' : 'experiences'} to discover
                  </small>
                </span>
                <span className="circle-arrow">
                  <ArrowUpRight size={20} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="section popular-section">
        <div className="container">
          <SectionHeading
            eyebrow="GOOD TRIPS. GREAT MEMORIES."
            title="Your next favorite story starts here."
            description="A few of our favorite escapes, with all the details taken care of."
            href="/packages"
          />
          <div className="category-tabs">
            <Link className="selected" href="/packages">
              All experiences
            </Link>
            <Link href="/packages?category=Beach+%26+Island">Beach & island</Link>
            <Link href="/packages?category=Adventure">Adventure</Link>
            <Link href="/packages?category=Mountain+%26+Nature">Nature & mountains</Link>
            <Link href="/packages?category=Cultural+%26+Historical">Culture & heritage</Link>
            <Link href="/packages?category=International">
              International <MoveUpRight size={13} />
            </Link>
          </div>
          <div className="tour-grid">
            {featured.map((p, i) => (
              <TourCard tour={p} index={i} key={p.id} />
            ))}
          </div>
        </div>
      </section>
      <section className="container promo-section">
        <div className="promo-art">
          <img
            src="https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1000&q=85"
            alt="Ocean waves reaching a sunlit shore"
            loading="lazy"
          />
          <span className="postcard-stamp">
            <Sun size={24} /> A LITTLE
            <br />
            VITAMIN SEA
          </span>
        </div>
        <div className="promo-copy">
          <span className="eyebrow">A LITTLE MORE REASON TO GO</span>
          <h2>
            Make room for
            <br />a little adventure.
          </h2>
          <p>
            {promo
              ? `${promo.name}. Save ${promo.discount_type === 'PERCENT' ? promo.value + '%' : money(promo.value)} on eligible reservations of ${money(promo.min_total)} or more.`
              : 'Trade the everyday for somewhere extraordinary. We’ll help you find a trip that feels just right.'}
          </p>
          {promo && (
            <div className="promo-code">
              <span>USE CODE</span>
              <strong>{promo.code}</strong>
              <small>Sample promotion · eligibility checked at checkout</small>
            </div>
          )}
          <Link href="/packages" className="btn primary">
            Let’s get away <ArrowUpRight size={18} />
          </Link>
        </div>
        <span className="promo-spark">✳</span>
      </section>
      <section className="section container">
        <SectionHeading
          eyebrow="BIG MEMORIES. SMALLER BUDGETS."
          title="Great escapes, within reach."
          description="A change of scenery doesn’t have to mean a change of budget."
          href="/packages?sort=price-asc"
          link="Explore budget-friendly trips"
        />
        <div className="tour-grid">
          {budget.map((p, i) => (
            <TourCard tour={p} index={i + 1} key={p.id} />
          ))}
        </div>
      </section>
      <section className="why-section">
        <div className="container why-grid">
          <div>
            <span className="eyebrow">MORE THAN A BOOKING</span>
            <h2>
              A little care makes
              <br />a world of difference.
            </h2>
            <p>
              From the first “what if” to the journey home, we’re here for the moments that matter.
            </p>
            <Link className="text-link" href="/about">
              Get to know us <ArrowUpRight size={17} />
            </Link>
          </div>
          <div className="why-features">
            {[
              [
                Route,
                'Thoughtful from start to finish',
                'Well-paced itineraries, meaningful stops, and the details that make a trip feel effortless.',
              ],
              [
                HeartHandshake,
                'People you can talk to',
                'Share your questions, your ideas, or your wildly ambitious travel wish list.',
              ],
              [
                ShieldCheck,
                'Clarity at every step',
                'See what’s included, review your reservation, and follow your payment status.',
              ],
              [
                Compass,
                'A trip that feels like you',
                'An island escape, a family adventure, or something entirely your own.',
              ],
            ].map(([Icon, title, body]) => {
              const I = Icon as typeof Route;
              return (
                <div key={String(title)}>
                  <span>
                    <I size={24} strokeWidth={1.5} />
                  </span>
                  <h3>{String(title)}</h3>
                  <p>{String(body)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      {reviews.rows.length > 0 ? (
        <section className="section container">
          <SectionHeading eyebrow="STORIES FROM THE JOURNEY" title="Good memories travel far." />
          <div className="review-grid">
            {reviews.rows.map((r) => (
              <article className="review-card" key={r.id}>
                <span className="stars" aria-label={`${r.rating} out of 5 stars`}>
                  {'★'.repeat(r.rating)}
                </span>
                <p>“{r.body}”</p>
                <strong>{r.name}</strong>
                <small>Verified completed booking · {r.title}</small>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="story-strip container">
          <Compass size={28} />
          <div>
            <h3>Your story could be the first.</h3>
            <p>
              We share reviews only from completed trips, after moderation. No made-up travel
              stories.
            </p>
          </div>
          <Link href="/packages" className="text-link">
            Start exploring <ArrowUpRight size={17} />
          </Link>
        </section>
      )}
      <section className="section container journal-section">
        <SectionHeading
          eyebrow="NOTES FOR THE ROAD"
          title="A little inspiration for the journey."
          href="/blog"
          link="Read the travel journal"
        />
        <div className="journal-grid">
          {['blog-packing', 'blog-islands'].map((key, i) => (
            <Link href={`/blog/${key.replace('blog-', '')}`} className="journal-card" key={key}>
              <img
                src={`https://images.unsplash.com/${i ? 'photo-1502680390469-be75c86b636f' : 'photo-1476514525535-07fb3b4ae5f1'}?auto=format&fit=crop&w=900&q=80`}
                alt={i ? 'An ocean adventure' : 'A peaceful lakeside view'}
                loading="lazy"
              />
              <div>
                <span className="eyebrow">{i ? 'ISLAND LIFE' : 'TRAVEL WELL'} · 3 MIN READ</span>
                <h3>{content[key]?.title}</h3>
                <span className="text-link">
                  Read story <ArrowUpRight size={16} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="section container faq-section">
        <div>
          <span className="eyebrow">A LITTLE PEACE OF MIND</span>
          <h2>
            Before you pack
            <br />
            your bags.
          </h2>
          <p>Good questions make for great trips.</p>
          <Link href="/contact" className="text-link">
            Ask our team <ArrowUpRight size={17} />
          </Link>
        </div>
        <div className="faqs">
          {content.faq?.body
            .split('\n')
            .slice(0, 4)
            .map((line, i) => {
              const [q, a] = line.split('|');
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
      </section>
      <section className="custom-banner container">
        <div>
          <span className="eyebrow">YOUR PEOPLE. YOUR PACE. YOUR PLACES.</span>
          <h2>Dream it. We’ll help plan it.</h2>
          <p>Something a little different in mind? Let’s make it a journey of your own.</p>
        </div>
        <Link className="btn ivory" href="/custom-tour">
          Plan a custom trip <ArrowRight size={18} />
        </Link>
      </section>
    </>
  );
}
