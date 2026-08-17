import { pgTable, text, integer, serial, timestamp } from 'drizzle-orm/pg-core';

export const userSettings = pgTable('user_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const bookmarks = pgTable('bookmarks', {
  id: serial('id').primaryKey(),
  issueKey: text('issue_key').notNull().unique(),
  summary: text('summary').notNull(),
  projectKey: text('project_key').notNull(),
  createdAt: integer('created_at').notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// OpenCode Pipeline Integration
// ─────────────────────────────────────────────────────────────────────────────

export const pipelineRuns = pgTable('pipeline_runs', {
  id:           text('id').primaryKey(),              // UUID v4
  taskKey:      text('task_key').notNull(),            // e.g. EMSPRO2-1234
  stage:        text('stage').notNull(),               // analyze | solution | execute | ...
  status:       text('status').notNull().default('IDLE'), // IDLE|RUNNING|DONE|FAILED|BLOCKED
  startedAt:    timestamp('started_at').defaultNow(),
  completedAt:  timestamp('completed_at'),
  outputFile:   text('output_file'),                  // relative path từ PROJECT_DIR
  wireLine:     text('wire_line'),                    // raw wire signal output
  errorMessage: text('error_message'),
  createdBy:    text('created_by'),                   // username (từ X-Jira-Auth header)
});

export type PipelineRunRecord = typeof pipelineRuns.$inferSelect;
export type NewPipelineRunRecord = typeof pipelineRuns.$inferInsert;
