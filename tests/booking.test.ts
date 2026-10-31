import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { type DB } from '../src/lib/db';
import { testDatabase } from '../scripts/test-db';
import { seed } from '../src/lib/seed';
import {
  createBooking,
  quote,
  authorizedBooking,
  submitPayment,
  reviewPayment,
  cancelBooking,
  transitionBooking,
  expireHolds,
} from '../src/lib/booking';
import { hashPassword, checkPassword, staff } from '../src/lib/security';
import { adminSave, savePackage } from '../src/lib/admin';
import { reports, csv } from '../src/lib/reports';
import { tours } from '../src/lib/data';
import type { User, Tour } from '../src/lib/types';
import { dayKey } from '../src/lib/format';
let db: DB;
let admin: User;
let customer: User;
let other: User;
let pkg: Tour;
let testStore: Awaited<ReturnType<typeof testDatabase>>;
before(async () => {
  testStore = await testDatabase();
  db = testStore.db;
  await seed(db);
  const add = async (email: string, role: string) =>
    (
      await db.insertSQL<User>(
        'INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,$4)',
        ['Test User', email, await hashPassword('Only-A-Test-Password!'), role],
      )
    ).rows[0];
  admin = await add('admin@example.test', 'SUPER_ADMIN');
  customer = await add('traveler@example.test', 'CUSTOMER');
  other = await add('other@example.test', 'CUSTOMER');
  pkg = (await tours(false, db))[0];
});
after(async () => {
  await testStore?.close();
});
test('departure date filtering follows Manila across UTC midnight', () => {
  assert.equal(dayKey('2026-11-06T16:30:00Z'), '2026-11-07');
  assert.equal(dayKey('2026-11-06T15:30:00Z'), '2026-11-06');
});
test('packages cannot publish without a complete itinerary', async () => {
  await assert.rejects(
    savePackage(
      db,
      {
        ...pkg,
        id: undefined,
        slug: 'incomplete-test-trip',
        images: [pkg.image_url],
        status: 'PUBLISHED',
      },
      admin,
    ),
    /complete itinerary/,
  );
});
async function schedule(capacity = 20) {
  return (
    await db.insertSQL<{ id: string }>(
      'INSERT INTO departures(package_id,departure_at,booking_deadline,capacity) VALUES($1,$2,$3,$4)',
      [
        pkg.id,
        new Date(Date.now() + 80 * 86400000 + Math.random() * 1000000),
        new Date(Date.now() + 75 * 86400000),
        capacity,
      ],
    )
  ).rows[0].id;
}
function input(departure_id: string, extra: Record<string, unknown> = {}) {
  return {
    departure_id,
    adults: 1,
    children: 0,
    code: '',
    contact_name: 'Test Traveler',
    contact_email: customer.email,
    contact_phone: '09123456789',
    payment_method: 'GCASH',
    travelers: [{ name: 'Test Traveler', type: 'ADULT' }],
    accepted_terms: true,
    ...extra,
  };
}
test('password hashes are salted and verify securely', async () => {
  const a = await hashPassword('a-safe-test-password');
  const b = await hashPassword('a-safe-test-password');
  assert.notEqual(a, b);
  assert.equal(await checkPassword('a-safe-test-password', a), true);
  assert.equal(await checkPassword('wrong', a), false);
});
test('server computes adult, child and eligible promotional pricing in centavos', async () => {
  const dep = await schedule();
  const result = await quote(db, { departure_id: dep, adults: 2, children: 1, code: 'LAKBAY10' });
  const subtotal = pkg.adult_price * 2 + pkg.child_price;
  assert.equal(result.subtotal, subtotal);
  assert.equal(result.discount, Math.floor(subtotal * 0.1));
  assert.equal(result.total, subtotal - result.discount);
  assert.equal(result.deposit_due, Math.ceil(result.total * 0.3));
});
test('ten competing reservations cannot overbook two seats', async () => {
  const dep = await schedule(2);
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () => createBooking(db, input(dep), customer)),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 2);
  const row = (
    await db.query<{ reserved: number }>('SELECT reserved FROM departures WHERE id=$1', [dep])
  ).rows[0];
  assert.equal(row.reserved, 2);
});
test('traveler counts and explicit acceptance are validated', async () => {
  const dep = await schedule();
  await assert.rejects(createBooking(db, input(dep, { adults: 2 }), customer), /one name/);
  await assert.rejects(createBooking(db, input(dep, { accepted_terms: false }), customer));
});
test('customer cannot access another reservation; private guest key works', async () => {
  const { booking, accessToken } = await createBooking(db, input(await schedule()), null);
  await assert.rejects(authorizedBooking(db, booking.reference, other), /access denied/);
  assert.equal((await authorizedBooking(db, booking.reference, null, accessToken)).id, booking.id);
  await assert.rejects(
    authorizedBooking(db, booking.reference, null, 'invalid-token'),
    /access denied/,
  );
  const registered = await createBooking(db, input(await schedule()), customer);
  await assert.rejects(
    authorizedBooking(db, registered.booking.reference, null, registered.accessToken),
    /access denied/,
  );
});
test('unverified reference never confirms a reservation and customers cannot verify', async () => {
  const { booking } = await createBooking(db, input(await schedule()), customer);
  await submitPayment(
    db,
    booking.reference,
    { amount: booking.deposit_due, method: 'GCASH', reference: 'TEST-' + booking.reference },
    customer,
  );
  const row = (
    await db.query<{ id: string }>('SELECT id FROM payment_submissions WHERE booking_id=$1', [
      booking.id,
    ])
  ).rows[0];
  assert.equal(
    (await authorizedBooking(db, booking.reference, customer)).status,
    'PAYMENT_UNDER_REVIEW',
  );
  await assert.rejects(
    reviewPayment(db, row.id, true, 'receipt checked', customer),
    /Staff access/,
  );
  assert.equal((await authorizedBooking(db, booking.reference, customer)).paid, 0);
});
test('verified deposit confirms; retry cannot duplicate ledger receipts', async () => {
  const { booking } = await createBooking(db, input(await schedule()), customer);
  await submitPayment(
    db,
    booking.reference,
    { amount: booking.deposit_due, method: 'BANK', reference: 'TEST-' + booking.reference },
    customer,
  );
  const p = (
    await db.query<{ id: string }>('SELECT id FROM payment_submissions WHERE booking_id=$1', [
      booking.id,
    ])
  ).rows[0];
  await reviewPayment(db, p.id, true, 'Matched actual test ledger receipt', admin);
  const b = await authorizedBooking(db, booking.reference, customer);
  assert.equal(b.status, 'CONFIRMED');
  assert.equal(b.paid, booking.deposit_due);
  await assert.rejects(reviewPayment(db, p.id, true, 'retry', admin), /already been reviewed/);
  assert.equal(
    (await authorizedBooking(db, booking.reference, customer)).paid,
    booking.deposit_due,
  );
  await assert.rejects(
    transitionBooking(db, booking.reference, 'COMPLETED', '', admin),
    /fully paid/,
  );
});
test('paid cancellation records offline refund and releases capacity exactly once', async () => {
  const dep = await schedule(1);
  const { booking } = await createBooking(db, input(dep), customer);
  await submitPayment(
    db,
    booking.reference,
    { amount: booking.total, method: 'CASH', reference: 'CASH-' + booking.reference },
    customer,
  );
  const p = (
    await db.query<{ id: string }>('SELECT id FROM payment_submissions WHERE booking_id=$1', [
      booking.id,
    ])
  ).rows[0];
  await reviewPayment(db, p.id, true, 'Test receipt matched', admin);
  await cancelBooking(db, booking.reference, 'Travel plans changed', customer);
  assert.equal((await authorizedBooking(db, booking.reference, customer)).status, 'REFUND_PENDING');
  await transitionBooking(db, booking.reference, 'REFUNDED', 'OFFLINE-REFUND-TEST', admin);
  assert.equal((await authorizedBooking(db, booking.reference, customer)).paid, 0);
  assert.equal(
    (await db.query<{ reserved: number }>('SELECT reserved FROM departures WHERE id=$1', [dep]))
      .rows[0].reserved,
    0,
  );
  await assert.rejects(
    transitionBooking(db, booking.reference, 'REFUNDED', 'OFFLINE-REFUND-TEST', admin),
  );
});
test('pending submissions can be rejected during cancellation review', async () => {
  const { booking } = await createBooking(db, input(await schedule()), customer);
  await submitPayment(
    db,
    booking.reference,
    { amount: booking.deposit_due, method: 'MAYA', reference: 'MAYA-' + booking.reference },
    customer,
  );
  await cancelBooking(db, booking.reference, 'Please cancel this test booking', customer);
  const p = (
    await db.query<{ id: string }>('SELECT id FROM payment_submissions WHERE booking_id=$1', [
      booking.id,
    ])
  ).rows[0];
  await reviewPayment(db, p.id, false, 'No actual receipt was found', admin);
  assert.equal((await authorizedBooking(db, booking.reference, customer)).status, 'REFUND_PENDING');
  await transitionBooking(db, booking.reference, 'CANCELLED', '', admin);
});
test('unpaid cancellation and hold expiry return seats without double-release', async () => {
  const dep = await schedule(2);
  const a = await createBooking(db, input(dep), customer);
  const b = await createBooking(db, input(dep), customer);
  await cancelBooking(db, a.booking.reference, 'Plans changed for testing', customer);
  await db.query('UPDATE bookings SET expires_at=now()-INTERVAL 1 SECOND WHERE id=$1', [
    b.booking.id,
  ]);
  await expireHolds(db);
  await expireHolds(db);
  assert.equal(
    (await db.query<{ reserved: number }>('SELECT reserved FROM departures WHERE id=$1', [dep]))
      .rows[0].reserved,
    0,
  );
});
test('promotion usage limits remain correct under competing reservations', async () => {
  const dep = await schedule(10);
  await db.query(
    "INSERT INTO promotions(name,code,discount_type,value,starts_at,ends_at,usage_limit) VALUES('One use','ONEONLY','PERCENT',5,now()-INTERVAL 1 DAY,now()+INTERVAL 2 DAY,1)",
  );
  const results = await Promise.allSettled(
    Array.from({ length: 4 }, () => createBooking(db, input(dep, { code: 'ONEONLY' }), customer)),
  );
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    (await db.query<{ used: number }>("SELECT used FROM promotions WHERE code='ONEONLY'")).rows[0]
      .used,
    1,
  );
  assert.equal(
    (await db.query<{ reserved: number }>('SELECT reserved FROM departures WHERE id=$1', [dep]))
      .rows[0].reserved,
    1,
  );
});
test('price and itinerary edits preserve historical booking snapshots', async () => {
  const { booking } = await createBooking(db, input(await schedule()), customer);
  await db.query('UPDATE package_pricing SET adult_price=adult_price+10000 WHERE package_id=$1', [
    pkg.id,
  ]);
  await db.query(
    "UPDATE itinerary_days SET title='Changed for future travelers' WHERE package_id=$1",
    [pkg.id],
  );
  const saved = await authorizedBooking(db, booking.reference, customer);
  assert.equal(saved.total, booking.total);
  assert.deepEqual(saved.snapshot.itinerary, booking.snapshot.itinerary);
});
test('RBAC rejects customer management and ordinary staff changing settings', async () => {
  assert.throws(() => staff(customer), /Staff access/);
  await assert.rejects(adminSave(db, 'content', {}, customer), /Staff access/);
  await assert.rejects(savePackage(db, {}, customer), /Staff access/);
  await assert.rejects(
    adminSave(db, 'settings', {}, { ...admin, role: 'STAFF' }),
    /super administrator/,
  );
});
test('reports use the verified ledger and exports neutralize spreadsheet formulas', async () => {
  const expected = Number(
    (
      await db.query<{ n: string }>(
        "SELECT COALESCE(sum(CASE WHEN kind='PAYMENT' THEN amount ELSE -amount END),0) n FROM payments",
      )
    ).rows[0].n,
  );
  const result = await reports(db);
  assert.equal(result.stats.revenue, expected);
  assert.equal(result.monthly.length, 6);
  assert.match(csv([{ name: '=HYPERLINK("evil")', total: 20 }]), /"'=HYPERLINK/);
});
