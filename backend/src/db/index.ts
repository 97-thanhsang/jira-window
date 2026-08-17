import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import { Pool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import * as schemaSqlite from './schema';
import * as schemaPg from './schema-pg';
import { runMigrations } from './migrate';

const DATABASE_URL = process.env.DATABASE_URL || '';
const isPostgres =
  DATABASE_URL.startsWith('postgresql://') || DATABASE_URL.startsWith('postgres://');

// ── PostgreSQL mode ────────────────────────────────────────────────────────────
if (isPostgres) {
  const pool = new Pool({ connectionString: DATABASE_URL });

  const initPg = runMigrations(pool)
    .then(() => {
      const pgDb = drizzlePg(pool, { schema: schemaPg });
      exports.db = pgDb;
      console.log('PostgreSQL connected and migrations applied.');
    })
    .catch((err: unknown) => {
      console.error('PostgreSQL connection failed:', err);
      process.exit(1);
    });

  exports.dbReady = initPg;
} else {
  // ── SQLite mode (default) ──────────────────────────────────────────────────
  const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/jira-power.db');
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const sqlite = new Database(DB_PATH);
  const sqliteDb = drizzleSqlite(sqlite, { schema: schemaSqlite });

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      issue_key TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      project_key TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  exports.db = sqliteDb;
  exports.dbReady = Promise.resolve();
}
