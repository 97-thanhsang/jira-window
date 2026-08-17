import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const userSettings = sqliteTable('user_settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const bookmarks = sqliteTable('bookmarks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  issueKey: text('issue_key').notNull().unique(),
  summary: text('summary').notNull(),
  projectKey: text('project_key').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
