# Verification record

MariaDB conversion reverified on October 31, 2026 (Asia/Manila), Windows, MariaDB 11.4.13, Node.js 24.18.0, Next.js 16.4.2.

| Check                                                        | Result                                                                                 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| TypeScript `npm run typecheck`                               | Passed                                                                                 |
| ESLint `npm run lint`                                        | Passed                                                                                 |
| Production `npm run build`                                   | Passed; App Router routes compiled                                                     |
| MariaDB integration tests                                    | 16 passed, 0 failed, using real InnoDB transactions across multiple pooled connections |
| Production HTTP smoke test                                   | Passed using a separate test database                                                  |
| Browser customer flow (October 23, before engine conversion) | Search → tour detail → checkout → guest reservation → cancellation                     |
| Browser responsiveness (October 23)                          | 412 px and 1440 px; no horizontal document overflow; mobile menu works                 |

The automated suite covers ten competing reservations for two remaining seats, mixed adult/child promotional pricing, traveler validation, private guest ownership, staff-only payment review, no confirmation on unverified submission, retry-safe verification, offline refund accounting, cancellation/expiry seat release, concurrent promotion limits, preserved historical snapshots, RBAC, monthly ledger revenue, and CSV formula neutralization.

The production HTTP smoke test covers actual Next.js rendering, registration, cookie sessions, anonymous/customer admin denial, cross-origin rejection, catalog/departures, server pricing despite a forged client total, booking creation/ownership, payment submission, staff verification, duplicate review denial, voucher PDF bytes, report totals, settings, custom inquiry/quotation, notifications, CSV export, cancellation/refund, and logout. The final smoke run also exercises package creation, itinerary configuration, publishing, and departure creation.

The October 23 browser test used the fictional package Palawan Island Adventure; reservation `LKB-2026-0D77BEA1` was cancelled. The October 31 HTTP tests use randomly generated credentials and isolated `lakbay_test_<uuid>` MariaDB schemas; those test schemas are removed after the runs. The original local database files remain backed up.

Live recovery completed on November 1, 2026 (Asia/Manila). Hostinger's managed deployment builder published source commit `17bcbff` as release `01a1967b-5d8d-7333-b845-f903cd7f4364`. The Linux standalone build completed successfully; the deployed runtime contains mysql2 and no PGlite package. The earlier SSH build reached the shared account's process limit (`EAGAIN`), so the managed builder was used instead.

The production database reports MariaDB `11.8.9-MariaDB-log`, UTC sessions, and 28 application tables. The new demonstration catalog contains eight packages and 40 departures. No customer accounts or bookings were fabricated. The original damaged embedded storage was preserved in private backups and was not imported into this fresh schema. A private MariaDB SQL backup and server environment backup were also saved with mode 0600 outside public_html.

Public HTTP checks returned 200 for `/api/health`, `/`, `/packages`, `/contact`, `/login`, and `/packages/palawan-island-adventure`. The health response was `{"status":"ok","database":"mysql-compatible"}`. Reloading the user's previously failing Chrome tab displayed the complete home page and travel imagery. These live checks verify access and database rendering; the full transactional HTTP suite above was run locally against isolated test schemas.

No real payment, email inbox delivery, or real travel availability was claimed during tests. Hosting-specific verification is recorded in the October 31 repair notes in HOSTINGER.md. Old embedded PostgreSQL data is retained in private backups; damaged recovery data must be restored from a valid backup before a business-data import.

Visual snapshots: [desktop](preview-desktop.jpg) and [mobile](preview-mobile.jpg).

On November 1, `npm audit --omit=dev --json` completed successfully and reported zero production dependency vulnerabilities. This supersedes the earlier DNS failure for that check; it does not claim a clean audit of development dependencies.
