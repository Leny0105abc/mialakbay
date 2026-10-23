import 'dotenv/config';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { embedded, migrate } from '../src/lib/db';
import { seed } from '../src/lib/seed';
import { hashPassword } from '../src/lib/security';
import type { Tour, Departure, Booking, Settings, Day } from '../src/lib/types';
const dir = path.resolve('.data', 'http-smoke-' + randomUUID());
await mkdir(dir, { recursive: true });
const db = embedded(dir);
await migrate(db);
await seed(db);
const password = randomUUID() + randomUUID();
await db.query(
  "INSERT INTO users(name,email,password_hash,role) VALUES('HTTP Test Administrator','smoke-admin@example.test',$1,'SUPER_ADMIN')",
  [await hashPassword(password)],
);
await db.close();
const base = 'http://localhost:3101';
let output = '';
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--port', '3101'],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: '',
      PGLITE_PATH: dir,
      ALLOW_EMBEDDED_PRODUCTION: 'true',
      APP_URL: base,
      RESEND_API_KEY: '',
      EMAIL_FROM: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  },
);
server.stdout.on('data', (d) => {
  output += d.toString();
});
server.stderr.on('data', (d) => {
  output += d.toString();
});
class Client {
  cookies = new Map<string, string>();
  async request<T = Record<string, unknown>>(url: string, body?: unknown, origin = base) {
    const res = await fetch(base + '/api/' + url, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: origin }),
        Cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const cookie of res.headers.getSetCookie()) {
      const [name, value] = cookie.split(';')[0].split('=');
      this.cookies.set(name, value);
    }
    const type = res.headers.get('content-type') || '';
    return {
      status: res.status,
      data: type.includes('json') ? ((await res.json()) as T) : await res.arrayBuffer(),
      headers: res.headers,
    };
  }
}
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(base);
      if (res.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  assert.ok(ready, 'Production server did not start. ' + output);
  const customer = new Client(),
    admin = new Client(),
    guest = new Client();
  assert.equal((await guest.request('admin/dashboard')).status, 401);
  assert.equal(
    (
      await customer.request('auth/register', {
        name: 'HTTP Test Traveler',
        email: 'smoke-traveler@example.test',
        password,
      })
    ).status,
    200,
  );
  assert.equal((await customer.request('admin/dashboard')).status, 403);
  assert.equal(
    (
      await customer.request(
        'profile',
        { name: 'Cross origin attempt', phone: '', address: '' },
        'https://other.example',
      )
    ).status,
    403,
  );
  assert.equal(
    (await admin.request('auth/login', { email: 'smoke-admin@example.test', password })).status,
    200,
  );
  for (const section of [
    'dashboard',
    'destinations',
    'packages',
    'itineraries',
    'departures',
    'reservations',
    'payments',
    'customers',
    'inquiries',
    'promotions',
    'reviews',
    'reports',
    'content',
    'settings',
    'audit',
  ]) {
    assert.equal((await admin.request('admin/' + section)).status, 200, 'Admin section ' + section);
  }
  for (const route of [
    '/destinations',
    '/packages',
    '/calendar',
    '/services',
    '/custom-tour',
    '/about',
    '/contact',
    '/blog',
    '/faq',
    '/privacy',
    '/terms',
    '/cancellation',
    '/login',
    '/register',
    '/lookup',
    '/sitemap.xml',
    '/robots.txt',
  ]) {
    assert.equal((await fetch(base + route)).status, 200, 'Public route ' + route);
  }
  const adminCookies = [...admin.cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  const pixel = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6jHgAAAAASUVORK5CYII=',
    'base64',
  );
  const upload = await fetch(base + '/api/assets', {
    method: 'POST',
    headers: { Origin: base, Cookie: adminCookies, 'Content-Type': 'image/png' },
    body: pixel,
  });
  assert.equal(upload.status, 200);
  const image = (await upload.json()) as { url: string };
  assert.equal((await fetch(base + image.url)).headers.get('content-type'), 'image/png');
  const badUpload = await fetch(base + '/api/assets', {
    method: 'POST',
    headers: { Origin: base, Cookie: adminCookies, 'Content-Type': 'image/svg+xml' },
    body: '<svg></svg>',
  });
  assert.equal(badUpload.status, 400);
  const packages = await customer.request<Tour[]>('packages');
  assert.equal(packages.status, 200);
  const tours = packages.data as Tour[];
  assert.equal(tours.length, 8);
  const pkg = tours[0];
  const draft = {
    ...pkg,
    id: undefined,
    title: 'QA Created Package',
    slug: 'qa-created-package',
    status: 'DRAFT',
    images: [pkg.image_url],
  };
  const draftResult = await admin.request<{ id: string }>('admin/packages', draft);
  assert.equal(draftResult.status, 200);
  const packageId = (draftResult.data as { id: string }).id;
  const itineraryResult = await admin.request<Day[]>('packages/itinerary?package=' + pkg.id);
  assert.equal(
    (
      await admin.request('admin/itineraries', {
        package_id: packageId,
        days: itineraryResult.data,
      })
    ).status,
    200,
  );
  assert.equal(
    (await admin.request('admin/packages', { ...draft, id: packageId, status: 'PUBLISHED' }))
      .status,
    200,
  );
  assert.equal(
    (
      await admin.request('admin/departures', {
        package_id: packageId,
        departure_at: '2030-02-01T08:00:00+08:00',
        booking_deadline: '2030-01-28T08:00:00+08:00',
        capacity: 12,
        price_adjustment: 10000,
        available: true,
      })
    ).status,
    200,
  );
  const departureResult = await customer.request<Departure[]>('departures?package=' + pkg.id);
  const departure = (departureResult.data as Departure[])[0];
  const body = {
    departure_id: departure.id,
    adults: 1,
    children: 0,
    code: 'LAKBAY10',
    contact_name: 'HTTP Test Traveler',
    contact_email: 'smoke-traveler@example.test',
    contact_phone: '09000000000',
    payment_method: 'GCASH',
    travelers: [{ name: 'HTTP Test Traveler', type: 'ADULT' }],
    accepted_terms: true,
    total: 1,
  };
  const created = await customer.request<{ reference: string }>('bookings', body);
  assert.equal(created.status, 200);
  const reference = (created.data as { reference: string }).reference;
  const detail = await customer.request<{ booking: Booking }>('bookings/' + reference);
  assert.equal(detail.status, 200);
  const booking = (detail.data as { booking: Booking }).booking;
  assert.equal(booking.total, pkg.adult_price - Math.floor(pkg.adult_price * 0.1));
  assert.equal(booking.status, 'PENDING_PAYMENT');
  assert.equal((await guest.request('bookings/' + reference)).status, 404);
  const submitted = await customer.request(`bookings/${reference}/payment`, {
    amount: booking.deposit_due,
    method: 'GCASH',
    reference: 'HTTP-QA-RECEIPT',
  });
  assert.equal(submitted.status, 200);
  const submissions = await admin.request<{ items: { id: string }[] }>('admin/payments');
  const id = (submissions.data as { items: { id: string }[] }).items[0].id;
  assert.equal(
    (
      await customer.request('admin/payments/' + id, {
        approved: true,
        note: 'Unauthorized review',
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await admin.request('admin/payments/' + id, {
        approved: true,
        note: 'Matched offline test receipt',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await admin.request('admin/payments/' + id, {
        approved: true,
        note: 'Duplicate test receipt',
      })
    ).status,
    409,
  );
  const confirmed = await customer.request<{ booking: Booking }>('bookings/' + reference);
  assert.equal((confirmed.data as { booking: Booking }).booking.status, 'CONFIRMED');
  const voucher = await customer.request('bookings/' + reference + '/voucher');
  assert.equal(voucher.status, 200);
  assert.equal(voucher.headers.get('content-type'), 'application/pdf');
  assert.equal(
    Buffer.from(voucher.data as ArrayBuffer)
      .subarray(0, 4)
      .toString(),
    '%PDF',
  );
  const stats = await admin.request<{ stats: { revenue: number } }>('admin/reports');
  assert.equal(stats.status, 200);
  assert.equal((stats.data as { stats: { revenue: number } }).stats.revenue, booking.deposit_due);
  const settingsResult = await admin.request<{ settings: Settings }>('admin/settings');
  assert.equal(settingsResult.status, 200);
  const settings = (settingsResult.data as { settings: Settings }).settings;
  assert.equal(
    (await admin.request('admin/settings', { ...settings, phone: 'QA phone' })).status,
    200,
  );
  assert.equal(
    (
      await customer.request('inquiries', {
        name: 'HTTP Test Traveler',
        email: 'smoke-traveler@example.test',
        phone: '09000000000',
        destination: 'Palawan custom adventure',
        start_date: '2030-01-01',
        end_date: '2030-01-05',
        travelers: 3,
        budget: 3000000,
        accommodation: 'Mid-range hotel',
        interests: 'Nature and food',
        requests: 'Test request',
      })
    ).status,
    200,
  );
  const inquiryResult = await admin.request<{ items: { id: string }[] }>('admin/inquiries');
  const inquiry = (inquiryResult.data as { items: { id: string }[] }).items[0];
  assert.equal(
    (
      await admin.request('admin/inquiries', {
        id: inquiry.id,
        status: 'QUOTED',
        amount: 2500000,
        message: 'Test quotation including accommodation and transfers.',
      })
    ).status,
    200,
  );
  assert.equal((await customer.request('notifications')).status, 200);
  assert.equal((await admin.request('admin/export')).status, 200);
  assert.equal(
    (
      await customer.request(`bookings/${reference}/cancel`, {
        reason: 'Cancel this isolated HTTP test booking',
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await admin.request(`admin/reservations/${reference}/status`, {
        status: 'REFUNDED',
        refund_reference: 'HTTP-QA-OFFLINE-REFUND',
      })
    ).status,
    200,
  );
  const refundedStats = await admin.request<{ stats: { revenue: number } }>('admin/reports');
  assert.equal((refundedStats.data as { stats: { revenue: number } }).stats.revenue, 0);
  assert.equal((await customer.request('auth/logout', {})).status, 200);
  assert.equal((await customer.request('bookings')).status, 401);
  assert.equal((await customer.request('bookings/' + reference)).status, 404);
  console.log(
    'HTTP smoke passed: production rendering, registration, RBAC, CSRF, pricing, reservation, payment review, idempotency, voucher PDF, reports, settings, inquiries, quotations, notifications, CSV, refund, and logout.',
  );
  console.log('Isolated QA database: ' + dir + ' (contains generated test data only).');
} catch (e) {
  console.error(output.slice(-8000));
  throw e;
} finally {
  if (server.exitCode === null) {
    server.kill();
    await new Promise<void>((resolve) => server.once('exit', () => resolve()));
  }
}
