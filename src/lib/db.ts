import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
export interface DB {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  transaction<T>(fn: (tx: DB) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
export function embedded(dataDir?: string): DB {
  const pg = new PGlite(dataDir);
  const wrap = (conn: Pick<PGlite, 'query' | 'exec'>): DB => ({
    query: async <T>(s: string, p: unknown[] = []) => ({ rows: (await conn.query<T>(s, p)).rows }),
    exec: (s) => conn.exec(s),
    transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))),
    close: () => pg.close(),
  });
  return wrap(pg);
}
function postgres(url: string): DB {
  const pool = new Pool({ connectionString: url, max: 10 });
  const wrap = (conn: Pick<Pool, 'query'>): DB => ({
    query: async <T>(s: string, p: unknown[] = []) => ({
      rows: (await conn.query(s, p)).rows as T[],
    }),
    exec: (s) => conn.query(s),
    transaction: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn(wrap(client));
        await client.query('COMMIT');
        return result;
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  });
  return wrap(pool);
}
export async function migrate(db: DB) {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
  );
  const files = (await readdir(path.join(process.cwd(), 'migrations')))
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const version = file.split('_')[0];
    const exists = await db.query('SELECT version FROM schema_migrations WHERE version=$1', [
      version,
    ]);
    if (!exists.rows.length)
      await db.transaction(async (tx) => {
        await tx.exec(await readFile(path.join(process.cwd(), 'migrations', file), 'utf8'));
        await tx.query('INSERT INTO schema_migrations(version) VALUES ($1)', [version]);
      });
  }
}
const globalDB = globalThis as unknown as { lakbayDB?: Promise<DB> };
export function getDB(options: { migrate?: boolean } = {}): Promise<DB> {
  globalDB.lakbayDB ??= (async () => {
    if (
      process.env.NODE_ENV === 'production' &&
      !process.env.DATABASE_URL &&
      process.env.ALLOW_EMBEDDED_PRODUCTION !== 'true'
    )
      throw new Error(
        'Set DATABASE_URL for production or explicitly opt into single-process embedded PostgreSQL with ALLOW_EMBEDDED_PRODUCTION=true.',
      );
    const dir = path.resolve(process.env.PGLITE_PATH || '.data/postgres');
    if (!process.env.DATABASE_URL) await mkdir(dir, { recursive: true });
    const db = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL) : embedded(dir);
    if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL && !options.migrate) {
      const latest = (await readdir(path.join(process.cwd(), 'migrations')))
        .filter((f) => f.endsWith('.sql'))
        .sort()
        .at(-1)!
        .split('_')[0];
      try {
        const result = await db.query('SELECT version FROM schema_migrations WHERE version=$1', [
          latest,
        ]);
        if (!result.rows.length) throw new Error('Missing migration');
      } catch {
        await db.close();
        throw new Error('Run npm run db:migrate in the release job before starting production.');
      }
    } else await migrate(db);
    return db;
  })();
  return globalDB.lakbayDB;
}
