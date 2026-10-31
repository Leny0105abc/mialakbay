import mysql, {
  type PoolConnection,
  type RowDataPacket,
  type ResultSetHeader,
  type PoolOptions,
} from 'mysql2/promise';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export interface DB {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; affectedRows: number }>;
  insertSQL<T = { id: string }>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; affectedRows: number }>;
  insert<T = { id: string }>(table: string, values: Record<string, unknown>): Promise<T>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (tx: DB) => Promise<T>): Promise<T>;
  connection<T>(fn: (db: DB) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
const jsonFields = new Set(['snapshot', 'inclusions', 'exclusions', 'value', 'detail']);
const booleanFields = new Set([
  'featured',
  'demo',
  'available',
  'included',
  'active',
  'seats_released',
]);
function normalizeRow(row: Record<string, unknown>) {
  for (const [key, value] of Object.entries(row)) {
    if (booleanFields.has(key) && value !== null) row[key] = Boolean(Number(value));
    else if (jsonFields.has(key) && typeof value === 'string' && /^[\[{]/.test(value))
      row[key] = JSON.parse(value);
    else if (
      ['paid', 'revenue', 'popularity', 'count', 'bookings'].includes(key) &&
      typeof value === 'string' &&
      /^-?\d+(?:\.\d+)?$/.test(value)
    )
      row[key] = Number(value);
    else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value))
      row[key] = new Date(value.replace(' ', 'T') + 'Z').toISOString();
  }
  return row;
}
function parameter(value: unknown) {
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  )
    return new Date(value);
  if (
    value !== null &&
    typeof value === 'object' &&
    !(value instanceof Date) &&
    !Buffer.isBuffer(value) &&
    !(value instanceof Uint8Array)
  )
    return JSON.stringify(value);
  if (value === undefined)
    throw new Error('Undefined SQL parameter. Use null for optional values.');
  return value;
}
const identifier = (name: string) => {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error('Invalid SQL identifier.');
  return '`' + name + '`';
};
export function databaseOptions(env: NodeJS.ProcessEnv = process.env): PoolOptions {
  let url: URL | undefined;
  if (env.DATABASE_URL) {
    url = new URL(env.DATABASE_URL);
    if (!['mysql:', 'mariadb:'].includes(url.protocol))
      throw new Error('DATABASE_URL must use mysql:// or mariadb://. PostgreSQL is not supported.');
  }
  const database = url ? decodeURIComponent(url.pathname.slice(1)) : env.DB_NAME;
  if (!database)
    throw new Error(
      'Configure DB_NAME and DB_HOST/DB_USER/DB_PASSWORD, or a mysql:// DATABASE_URL. See .env.example.',
    );
  return {
    host: url?.hostname || env.DB_HOST || '127.0.0.1',
    port: Number(url?.port || env.DB_PORT || 3306),
    user: url ? decodeURIComponent(url.username) : env.DB_USER || 'root',
    password: url ? decodeURIComponent(url.password) : env.DB_PASSWORD || '',
    database,
    connectionLimit: Number(env.DB_POOL_SIZE || 5),
    connectTimeout: 10000,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    multipleStatements: false,
    ...(env.DB_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
  };
}
export function mysqlDatabase(options: PoolOptions): DB {
  const pool = mysql.createPool(options);
  const wrap = (pinned?: PoolConnection, inTransaction = false): DB => {
    const connection = async <T>(fn: (db: DB) => Promise<T>): Promise<T> => {
      if (pinned) return fn(wrap(pinned, inTransaction));
      const conn = await pool.getConnection();
      try {
        await conn.query("SET time_zone='+00:00'");
        await conn.query('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');
        return await fn(wrap(conn));
      } finally {
        conn.release();
      }
    };
    const db: DB = {
      connection,
      query: async <T>(sql: string, params: unknown[] = []) => {
        if (!pinned) return connection((tx) => tx.query<T>(sql, params));
        const bindings: unknown[] = [];
        // Numbered application bindings are converted to native prepared-statement parameters.
        const nativeSQL = sql.replace(/\$(\d+)/g, (_match, index) => {
          bindings.push(parameter(params[Number(index) - 1]));
          return '?';
        });
        const [result] = await pinned.execute(
          nativeSQL,
          bindings as Parameters<PoolConnection['execute']>[1],
        );
        return Array.isArray(result)
          ? {
              rows: (result as RowDataPacket[]).map((r) => normalizeRow({ ...r })) as T[],
              affectedRows: 0,
            }
          : { rows: [] as T[], affectedRows: (result as ResultSetHeader).affectedRows };
      },
      insertSQL: async <T>(sql: string, params: unknown[] = []) =>
        connection(async (tx) => {
          const match = /^INSERT INTO ([a-z_]+)\s*\(/i.exec(sql);
          if (!match) throw new Error('insertSQL requires a single VALUES insert.');
          const id = randomUUID();
          const native = sql
            .replace(/^(INSERT INTO [a-z_]+\s*\()/i, (prefix) => prefix + 'id,')
            .replace(/VALUES\s*\(/i, () => 'VALUES($' + (params.length + 1) + ',');
          await tx.query(native, [...params, id]);
          return tx.query<T>('SELECT * FROM ' + identifier(match[1]) + ' WHERE id=$1', [id]);
        }),
      insert: async <T>(table: string, values: Record<string, unknown>) =>
        connection(async (tx) => {
          const row = { id: randomUUID(), ...values };
          const keys = Object.keys(row);
          await tx.query(
            `INSERT INTO ${identifier(table)} (${keys.map(identifier).join(',')}) VALUES (${keys.map((_, i) => '$' + (i + 1)).join(',')})`,
            Object.values(row),
          );
          return (await tx.query<T>(`SELECT * FROM ${identifier(table)} WHERE id=$1`, [row.id]))
            .rows[0];
        }),
      exec: async (sql) => {
        await connection(async (tx) => {
          for (const statement of sql
            .replace(/^\s*--.*$/gm, '')
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean))
            await tx.query(statement);
        });
      },
      transaction: (fn) =>
        connection(async (tx) => {
          if (!pinned) return tx.transaction(fn);
          if (inTransaction) throw new Error('Nested transactions are not supported.');
          await pinned.beginTransaction();
          try {
            const value = await fn(wrap(pinned, true));
            await pinned.commit();
            return value;
          } catch (e) {
            await pinned.rollback();
            throw e;
          }
        }),
      close: () => pool.end(),
    };
    return db;
  };
  return wrap();
}
export async function migrate(db: DB) {
  await db.connection(async (conn) => {
    const lock = (
      await conn.query<{ acquired: number }>(
        "SELECT GET_LOCK(CONCAT('lakbay:migrate:',DATABASE()),30) AS acquired",
      )
    ).rows[0];
    if (lock.acquired !== 1) throw new Error('Another migration is running. Try again later.');
    try {
      await conn.query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (version varchar(64) PRIMARY KEY,checksum char(64) NOT NULL,applied_at datetime(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB',
      );
      for (const file of (await readdir(path.join(process.cwd(), 'migrations')))
        .filter((f) => f.endsWith('.sql'))
        .sort()) {
        const version = file.split('_')[0];
        const sql = await readFile(path.join(process.cwd(), 'migrations', file), 'utf8');
        const checksum = createHash('sha256').update(sql.replaceAll('\r\n', '\n')).digest('hex');
        const applied = (
          await conn.query<{ checksum: string }>(
            'SELECT checksum FROM schema_migrations WHERE version=$1',
            [version],
          )
        ).rows[0];
        if (applied) {
          if (applied.checksum !== checksum)
            throw new Error(
              `Migration ${version} changed after application. Add a new migration instead.`,
            );
          continue;
        }
        // MariaDB/MySQL DDL commits implicitly. Statements are retry-safe; write the version last.
        await conn.exec(sql);
        await conn.query('INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)', [
          version,
          checksum,
        ]);
      }
    } finally {
      await conn.query("SELECT RELEASE_LOCK(CONCAT('lakbay:migrate:',DATABASE()))");
    }
  });
}
const state = globalThis as unknown as { lakbayMariaDB?: Promise<DB> };
export function getDB(options: { migrate?: boolean } = {}): Promise<DB> {
  state.lakbayMariaDB ??= (async () => {
    const db = mysqlDatabase(databaseOptions());
    try {
      if (options.migrate) await migrate(db);
      else {
        const latest = (await readdir(path.join(process.cwd(), 'migrations')))
          .filter((f) => f.endsWith('.sql'))
          .sort()
          .at(-1)!
          .split('_')[0];
        const result = await db.query('SELECT version FROM schema_migrations WHERE version=$1', [
          latest,
        ]);
        if (!result.rows.length) throw new Error('Missing migrations. Run npm run db:migrate.');
      }
      return db;
    } catch (e) {
      await db.close();
      state.lakbayMariaDB = undefined;
      throw e;
    }
  })();
  return state.lakbayMariaDB;
}
