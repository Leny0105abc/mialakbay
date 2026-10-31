# Verification record

MariaDB conversion reverified on October 31, 2026 (Asia/Manila), Windows, MariaDB 11.4.13, Node.js 24.18.0, Next.js 16.4.2.

| Check                          | Result                                                                                                           |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| TypeScript `npm run typecheck` | Passed                                                                                                           |
| ESLint `npm run lint`          | Passed                                                                                                           |
| Production `npm run build`     | Passed; App Router routes compiled                                                                               |
| MariaDB integration tests      | 16 passed, 0 failed, using real InnoDB transactions across multiple pooled connections                           |
| Production HTTP smoke test     | Passed using a separate test database                                                                            |
| Browser customer flow          | Search → tour detail → checkout → server quote/discount → guest reservation → reservation details → cancellation |
| Browser responsiveness         | Mobile/default 412 px and desktop 1440 px; no horizontal document overflow; mobile menu works                    |

The automated suite covers ten competing reservations for two remaining seats, mixed adult/child promotional pricing, traveler validation, private guest ownership, staff-only payment review, no confirmation on unverified submission, retry-safe verification, offline refund accounting, cancellation/expiry seat release, concurrent promotion limits, preserved historical snapshots, RBAC, monthly ledger revenue, and CSV formula neutralization.

The production HTTP smoke test covers actual Next.js rendering, registration, cookie sessions, anonymous/customer admin denial, cross-origin rejection, catalog/departures, server pricing despite a forged client total, booking creation/ownership, payment submission, staff verification, duplicate review denial, voucher PDF bytes, report totals, settings, custom inquiry/quotation, notifications, CSV export, cancellation/refund, and logout. The final smoke run also exercises package creation, itinerary configuration, publishing, and departure creation.

The browser test used the clearly fictional package Palawan Island Adventure. Its test reservation `LKB-2026-0D77BEA1` was cancelled and its seat released. No payment was recorded in the main local database. HTTP test users/transactions are isolated in `.data/http-smoke-<uuid>` and use randomly generated passwords.

No real payment, email inbox delivery, or real travel availability was claimed during tests. Hosting-specific verification is recorded in the October 31 repair notes in HOSTINGER.md. Old embedded PostgreSQL data is retained in private backups; damaged recovery data must be restored from a valid backup before a business-data import.

Visual snapshots: [desktop](preview-desktop.jpg) and [mobile](preview-mobile.jpg).

Dependency vulnerability audit could not complete: the npm advisory endpoint failed DNS resolution (`ENOTFOUND registry.npmjs.org`). No clean vulnerability-audit result is claimed.
