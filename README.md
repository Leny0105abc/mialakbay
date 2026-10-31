# Lakbay Travel & Tours

A working travel reservation and agency management application built with Next.js App Router, React, TypeScript, Tailwind CSS, Zod, MariaDB/MySQL, Recharts, and pdf-lib. Source is in this repository; no hosted deployment or live payment collection has been enabled.

## Start locally

Use Node.js **22.13 or newer** (Node 24 recommended) and npm. A running MariaDB 10.11+ or MySQL 8.0.16+ server is required.

```powershell
npm ci
Copy-Item .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). To use another port, update `APP_URL` in `.env`, then run `npm run dev -- --port 3002`.

Use the DB_HOST, DB_PORT, DB_NAME, DB_USER, and DB_PASSWORD values in `.env` to connect to your dedicated MariaDB/MySQL schema. An optional mysql:// or mariadb:// DATABASE_URL is supported. There is no embedded database fallback. The application uses mysql2 prepared statements and InnoDB transactions. See [docs/HOSTINGER.md](docs/HOSTINGER.md) for the production setup. The original PostgreSQL storage, if present in .data, is retained only as a private backup and is not used by the application.

The seed is explicit and repeat-safe on a fresh installation. It creates eight fictional demonstration tours, sample prices, itineraries, future schedules, one sample discount, draft policy text, and editable website content. It creates **no default administrator, customer accounts, bookings, receipts, or reviews**. Do not use sample details for live travel sales. A cancelled `QA Test Traveler` guest reservation may be present in the current local database from browser verification; no real funds were transferred.

## Create the administrator

Set these values in your local `.env`, which is ignored by Git:

```dotenv
ADMIN_EMAIL=your-business-email@example.com
ADMIN_NAME=Agency Administrator
ADMIN_PASSWORD=replace-with-a-unique-password-at-least-12-characters
```

```powershell
npm run admin:create
npm run dev
```

Sign in at `/admin/login`. There are **no shared or hardcoded login credentials**. Remove `ADMIN_PASSWORD` from `.env` after setup. The CLI refuses to overwrite an existing account. A super administrator can add agency staff through Settings; ordinary staff cannot add users or change business/payment settings. Customer accounts are created through `/register`.

## What works

- Public home, destination explorer, package search and filtering, package galleries, detailed itineraries, departure calendar, services, custom requests, contact, travel journal, FAQ, and editable policies.
- Search by destination/package; filter by category, budget, duration, departure date, and party size; sort by featured order, verified booking popularity, price, and duration. Availability is derived from stored departure capacity and reserved travelers.
- Customer registration/login, profile, trip dashboard, booking history/details, in-app notifications, inquiries/quotations, and secure guest booking lookup.
- Checkout with adult/child pricing, seasonal per-person surcharges, server-validated percentage/fixed promotions, price review, manual payment selection, unique booking references, and explicit terms acceptance.
- Transactional seat reservations, 48-hour unpaid holds, conditional capacity updates, row locks, promotion limits, immutable booking price/policy/itinerary snapshots, cancellation review, and offline full-refund recording.
- GCash, Maya, bank transfer, and cash/office instructions. Customers submit references; staff verifies the actual receipt. Verified deposits can confirm reservations; a submitted reference alone cannot.
- PDF booking vouchers for confirmed/completed reservations and printable original itineraries.
- Administration for destinations, packages/images, itinerary days/activities, schedules, reservations, payments, customers/history, inquiries/quotations, promotions/eligibility, reviews, reports/CSV, content, branding/contact/payment settings, staff accounts, and audit logs.
- Reviews require a completed, fully paid trip and customer ownership; only moderated approved reviews appear publicly. No fictional testimonials are seeded.
- Database-backed dashboards and six-month charts. **Revenue means verified receipts minus recorded offline refunds**, by ledger receipt date in Asia/Manila. Pending reservations and unverified payment submissions do not count as revenue.
- PNG/JPEG/WebP image uploads, verified by file signatures, limited to 2 MB, with server authorization. Images are stored in MariaDB/MySQL and served with immutable asset URLs. Upload public marketing imagery only. Payment proof uploads are not collected; payment references are sufficient for the supported manual workflow.
- Opaque hashed database sessions, HttpOnly/SameSite cookies, scrypt password hashing with random salts, server RBAC, request-origin checks, bounded JSON bodies, Zod validation, database rate limiting, safe CSV cells, response security headers, and administrative audit records.
- Responsive layouts, mobile filters/menu/checkout, keyboard focus indicators, loading/error/empty states, page metadata, sitemap, robots rules, and TouristTrip structured data.

## Operating the agency

1. Configure real business contact details, branding, payment collection instructions, and actual policies in **Settings** and **Website content**.
2. Create a destination, save a **draft package**, configure exactly one itinerary day per package day, and then publish it. Add departure schedules with booking deadlines and capacity.
3. Replace or archive all demonstration packages. Turn `DEMO_MODE=false` only when the installation and content are actually ready for live use. Individual packages retain their own demo marker.
4. A customer reserves a departure. The server checks capacity, price, discounts, travelers, and terms and saves the original package details.
5. The customer submits a receipt/reference after paying through the configured offline channel. In **Payment verification**, match the reference and amount against the real wallet/bank/office ledger. Record your decision and review note.
6. A verified deposit at or above the required threshold confirms the trip. Further verified payments reduce the outstanding balance. Only fully paid trips that have ended can be completed.
7. Review cancellation requests. A paid or unresolved submission enters **Refund Pending**. Resolve any outstanding submission first. For paid cancellations, carry out the actual offline refund and enter its reference to record the refund and release seats. An unpaid request can be closed without a refund. The app never transfers funds itself.
8. Customers with completed bookings may submit a review. Approve or reject it in Reviews.

Promotional usage is consumed when a reservation is created and is not restored on cancellation or expiry. Unpaid holds expire after 48 hours unless a payment is awaiting review or money has been verified. Reservations under payment/cancellation review intentionally retain seats until staff resolves them.

Guest access requires the reference, email, and a random private key shown once after checkout. The current browser also receives an HttpOnly access cookie for 30 days. The application never authorizes guest access by reference/email alone. A guest key is a bearer credential; keep it private. Lost access requires staff assistance.

## Notifications and scheduled maintenance

```powershell
npm run maintenance
```

Run this every 15 minutes in your production scheduler. It releases expired unpaid holds, removes expired sessions/rate-limit buckets, creates one upcoming-trip reminder per confirmed booking within three days, and retries pending email notifications. Bookings and availability views also release expired holds. The scheduler is documented, not installed on your computer. The web server and scheduled commands may run concurrently against the same MariaDB database.

Optional transactional email uses the Resend HTTP API. Set `RESEND_API_KEY` and `EMAIL_FROM` to a verified sender. New notifications are queued transactionally. `SENT` means the provider accepted the API request; it does not claim inbox delivery. `FAILED` remains retryable; `NOT_CONFIGURED` means no email was attempted. Previously unconfigured notifications are not retroactively sent. The integration uses notification IDs as provider idempotency keys; [Resend retains those keys for 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys). Do not endlessly retry an ambiguous delivery beyond that window without reviewing provider records.

## Environment

See [.env.example](.env.example). No environment variable needs to be exposed as `NEXT_PUBLIC_*`.

| Variable                                                   | Purpose                                                                     |
| ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD            | MariaDB/MySQL connection; Hostinger host is 127.0.0.1                       |
| DB_POOL_SIZE                                               | Connection pool size (default 5)                                            |
| DB_SSL                                                     | true for verified TLS to a remote database                                  |
| DATABASE_URL                                               | Optional mysql:// or mariadb:// connection URL alternative                  |
| APP_URL                                                    | Exact canonical origin, including port, for request protection and metadata |
| DEMO_MODE                                                  | Explicit demonstration banner                                               |
| ADMIN_EMAIL, ADMIN_NAME, ADMIN_PASSWORD                    | CLI-only administrator setup                                                |
| RESEND_API_KEY, EMAIL_FROM                                 | Optional email provider credentials                                         |
| TEST_DB_HOST, TEST_DB_PORT, TEST_DB_USER, TEST_DB_PASSWORD | Dedicated integration-test connection with CREATE/DROP on lakbay_test_*     |

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run test:smoke
```

`npm test` runs against a newly created, isolated MariaDB schema and drops only that schema afterwards. Tests cover hashing, pricing, overbooking, promotion concurrency, permissions, ownership, payment review, refunds, cancellation, snapshots, reports, and CSV safety. `npm run test:smoke` requires a current production build, creates another isolated MariaDB schema, and starts a temporary server on port 3101 to exercise actual HTTP routes. Test credentials are never printed. Configure a dedicated TEST_DB_USER; never point tests at production.

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the latest results and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for data and API design.

## Deploy

Follow [docs/HOSTINGER.md](docs/HOSTINGER.md) for the exact Hostinger environment, migrations, build, backup, and verification steps. The app requires Node.js hosting and MariaDB/MySQL; it is not a static HTML export. No PostgreSQL service is required.

## External configuration and scope

- **Card checkout is disabled**, including when arbitrary credentials are added. `src/lib/payment-provider.ts` defines the integration boundary. A concrete provider adapter and its signature-verified, idempotent webhook handling must be implemented and tested before enabling card payments. No card numbers are collected or stored.
- Wallet/bank methods are **manual receipt workflows**, not GCash/Maya API integrations. Configure genuine collection instructions before live use.
- Flight/hotel/visa services are inquiry-based. There is no live supplier inventory or visa approval guarantee.
- Email needs a provider key, verified sender, and scheduled retries. No email delivery was claimed during local tests.
- Agency legal/privacy/cancellation text and imagery must be approved/replaced by the actual operator. Demonstration photography is illustrative and comes from Unsplash image URLs.
- Password reset, MFA, partial refunds, payment-proof uploads, supplier/flight APIs, and automated financial transfers are not implemented. The supported workflows are clearly bounded above.

Framework references: [Next.js deployment](https://nextjs.org/docs/app/getting-started/deploying), [Hostinger MySQL setup](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/), [mysql2](https://sidorares.github.io/node-mysql2/docs).
