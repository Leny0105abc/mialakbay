import 'dotenv/config';
import mysql from 'mysql2/promise';
import { randomUUID } from 'node:crypto';
import { mysqlDatabase, migrate } from '../src/lib/db';

// Each test run owns a new schema. Never run tests against the application's schema.
export async function testDatabase() {
  if (!process.env.TEST_DB_USER)
    throw new Error(
      'Set TEST_DB_HOST/PORT/USER/PASSWORD for a local MariaDB test user with CREATE/DROP on lakbay_test_*.',
    );
  const name = 'lakbay_test_' + randomUUID().replaceAll('-', '');
  const options = {
    host: process.env.TEST_DB_HOST || '127.0.0.1',
    port: Number(process.env.TEST_DB_PORT || 3306),
    user: process.env.TEST_DB_USER,
    password: process.env.TEST_DB_PASSWORD || '',
  };
  const admin = await mysql.createConnection(options);
  await admin.query(
    'CREATE DATABASE `' + name + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
  );
  const db = mysqlDatabase({
    ...options,
    database: name,
    connectionLimit: 10,
    timezone: 'Z',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: false,
    charset: 'utf8mb4',
  });
  await migrate(db);
  return {
    db,
    name,
    env: {
      DATABASE_URL: '',
      DB_HOST: options.host,
      DB_PORT: String(options.port),
      DB_NAME: name,
      DB_USER: options.user,
      DB_PASSWORD: options.password,
    },
    async close() {
      await db.close();
      if (!/^lakbay_test_[a-f0-9]{32}$/.test(name))
        throw new Error('Refusing unexpected test schema cleanup.');
      await admin.query('DROP DATABASE `' + name + '`');
      await admin.end();
    },
  };
}
