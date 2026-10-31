# Hostinger deployment and recovery

The application requires a MariaDB/MySQL database and a Node.js web app. It has no embedded PostgreSQL fallback. Hostinger's Node.js support depends on your plan; use the existing **Web app** for `mialakbay.lenybuilds.com`.

## Database

Create a dedicated database and database user in Websites → Manage site → Databases → Management. Save the password in a password manager. Hostinger prefixes names, so use the complete values displayed in hPanel.

Set the app's server environment values in hPanel:

```dotenv
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=u464614554_mialakbay
DB_USER=u464614554_mialakbay
DB_PASSWORD=your-private-database-password
DB_POOL_SIZE=5
DB_SSL=false
APP_URL=https://mialakbay.lenybuilds.com
DEMO_MODE=true
```

Use the actual names from hPanel if they differ. Leave `DATABASE_URL` empty when using `DB_*`. Remove obsolete `ALLOW_EMBEDDED_PRODUCTION` and `PGLITE_PATH` settings. DB_SSL=false is for Hostinger's local database socket over 127.0.0.1; use verified TLS for a remote database.

## Release

Use Node.js 22 or 24, `npm ci`, and `npm run hostinger:build`. The build produces a Next.js standalone server and includes migrations, static assets, and public files. Do not upload `.env`, `.data`, `node_modules`, or Windows build output to Hostinger. Build on the hosting server.

Before starting the new application, run from the source directory with the same production database environment:

```sh
npm run db:migrate
npm run db:check
```

Migrations use an advisory lock, InnoDB tables, UTF-8, foreign keys, and checksums. MariaDB/MySQL DDL commits implicitly; migration files therefore use retry-safe CREATE statements and record completion after the statements succeed. Existing PostgreSQL data cannot be imported as SQL with these migrations.

For a new demonstration database only, `npm run db:seed` inserts the eight clearly labeled fictional tours and sample content. For an existing valid application export, `npm run db:import -- /private/path/export.json` imports into an empty schema transactionally, preserving IDs, prices, users, receipts, and snapshots. Do not seed over recovered business data.

The first administrator is created through `npm run admin:create` using temporary ADMIN_EMAIL/ADMIN_NAME/ADMIN_PASSWORD server variables. Remove the setup password afterwards; there are no default public administrator credentials.

## Verify and maintain

1. `/api/health` must return HTTP 200 and `{"status":"ok","database":"mysql-compatible"}`. It returns 503 while the database is unavailable, without disclosing credentials.
2. Open the home page, packages, a package's itinerary/dates, contact form, and login page.
3. Use a test booking to check pricing, capacity, guest/account access, staff payment review, and the PDF voucher. Never send real funds when testing demo content.
4. Schedule `npm run maintenance` every 15 minutes with the same database settings to expire unpaid holds, create upcoming-trip reminders, and retry configured emails.
5. Back up both the database and uploaded image records. Preserve the previous deployment and original database until restoration has been verified.

## October 31 recovery evidence

The old production runtime returned HTTP 500 and logged PGlite `RuntimeError: Aborted()`. Testing a private copy of its storage also reported an invalid recovery checkpoint. Its files and source were backed up before replacement, outside public_html. No archive, database files, credentials, or customer records are included in Git.

If the original store contains business records, recover a valid older backup and export its data before importing it. A damaged store must not be silently treated as a valid migration or deleted after starting a fresh demo schema.

Official references: [Hostinger MySQL connection setup](https://www.hostinger.com/support/connecting-a-hostinger-mysql-database-to-a-node-js-application/), [Node.js deployment](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/), [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
