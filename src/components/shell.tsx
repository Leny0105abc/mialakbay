'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Compass,
  Menu,
  X,
  ArrowUpRight,
  UserRound,
  LogOut,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook,
} from 'lucide-react';
import type { Settings, User } from '@/lib/types';
import { api } from './ui';
export function Logo({
  brand = 'Lakbay',
  tagline = 'Travel & Tours',
  logo_url,
}: {
  brand?: string;
  tagline?: string;
  logo_url?: string;
}) {
  return (
    <Link href="/" className="logo" aria-label={`${brand} home`}>
      <span className="logo-icon">
        {logo_url ? (
          <img src={logo_url} alt="" style={{ width: 34, height: 34, objectFit: 'contain' }} />
        ) : (
          <Compass size={29} strokeWidth={1.6} />
        )}
      </span>
      <span>
        {brand.toLowerCase()}
        <small>{tagline.toUpperCase()}</small>
      </span>
      <span className="logo-dot">✦</span>
    </Link>
  );
}
export function Header({
  user,
  settings,
  demo,
}: {
  user: User | null;
  settings: Settings;
  demo: boolean;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const router = useRouter();
  const links = [
    ['/destinations', 'Destinations'],
    ['/packages', 'Tour packages'],
    ['/services', 'Travel services'],
    ['/about', 'About us'],
  ];
  return (
    <>
      <div className="announcement">
        {demo
          ? 'A world of possibilities. Made for exploring.'
          : 'Thoughtfully planned. Beautifully experienced.'}
        <span>
          {demo ? 'Sample tours & prices · For testing only' : 'Your next adventure starts here'}{' '}
          <ArrowUpRight size={12} />
        </span>
      </div>
      <header className="site-header">
        <div className="container nav-wrap">
          <Logo brand={settings.brand} tagline={settings.tagline} logo_url={settings.logo_url} />
          <nav
            aria-label="Main navigation"
            className={open ? 'nav-links mobile-open' : 'nav-links'}
          >
            {links.map(([href, title]) => (
              <Link
                key={href}
                href={href}
                className={path.startsWith(href) ? 'active' : ''}
                onClick={() => setOpen(false)}
              >
                {title}
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            <Link className="nav-contact" href="/contact">
              Let’s plan a trip <ArrowUpRight size={16} />
            </Link>
            {user ? (
              <div className="user-actions">
                <Link
                  href={user.role === 'CUSTOMER' ? '/account' : '/admin'}
                  className="avatar"
                  title="Your dashboard"
                >
                  {user.name.charAt(0)}
                </Link>
                <button
                  className="icon-btn logout"
                  aria-label="Sign out"
                  onClick={async () => {
                    await api('auth/logout', {});
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <LogOut size={17} />
                </button>
              </div>
            ) : (
              <Link href="/login" className="icon-btn" aria-label="Sign in">
                <UserRound size={20} />
              </Link>
            )}
            <button
              className="icon-btn menu-btn"
              aria-expanded={open}
              aria-label={open ? 'Close menu' : 'Open menu'}
              onClick={() => setOpen(!open)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
export function Footer({ settings }: { settings: Settings }) {
  return (
    <footer className="footer">
      <div className="container footer-main">
        <div>
          <Logo brand={settings.brand} tagline={settings.tagline} logo_url={settings.logo_url} />
          <p>
            Good places. Great memories.
            <br />
            Your journey, thoughtfully planned.
          </p>
          <div className="socials">
            {settings.instagram && (
              <a href={settings.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                <Instagram size={19} />
              </a>
            )}
            {settings.facebook && (
              <a href={settings.facebook} target="_blank" rel="noreferrer" aria-label="Facebook">
                <Facebook size={19} />
              </a>
            )}
          </div>
        </div>
        <div>
          <h4>Find your next adventure</h4>
          <Link href="/destinations">Explore destinations</Link>
          <Link href="/packages">Tour packages</Link>
          <Link href="/calendar">Departure calendar</Link>
          <Link href="/custom-tour">Create your own trip</Link>
        </div>
        <div>
          <h4>A little about us</h4>
          <Link href="/about">Our story</Link>
          <Link href="/services">Travel services</Link>
          <Link href="/blog">Travel journal</Link>
          <Link href="/faq">Frequently asked questions</Link>
        </div>
        <div>
          <h4>Let’s stay in touch</h4>
          {settings.email && (
            <a href={`mailto:${settings.email}`}>
              <Mail size={15} />
              {settings.email}
            </a>
          )}
          {settings.phone && (
            <a href={`tel:${settings.phone}`}>
              <Phone size={15} />
              {settings.phone}
            </a>
          )}
          {settings.address && (
            <p>
              <MapPin size={15} />
              {settings.address}
            </p>
          )}
          <Link href="/contact">
            Contact our travel team <ArrowUpRight size={15} />
          </Link>
          <Link href="/lookup">Find a guest reservation</Link>
          <Link href="/account">My travel dashboard</Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} {settings.brand} Travel & Tours.
        </span>
        <div>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Booking terms</Link>
          <Link href="/cancellation">Cancellation policy</Link>
          <Link href="/admin">Agency portal</Link>
        </div>
        <span>
          Made for the journey <Compass size={14} />
        </span>
      </div>
    </footer>
  );
}
