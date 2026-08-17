import { Pool } from 'pg';

export async function runMigrations(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id SERIAL PRIMARY KEY,
      issue_key TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      project_key TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}
