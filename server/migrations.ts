import type { Migration } from './migrate';

/**
 * Schema changes made AFTER the first release, oldest first. Version 1 is the baseline (everything in `SCHEMA` in db.ts) and is recorded automatically.
 *
 * How to add one (see docs/MIGRATIONS.md):
 *  1. Append `{ version: <last + 1>, name: 'short_snake_case', sql: '...' }`. Use `{ sqlite: '...', pg: '...' }` when the two engines differ.
 *  2. Never edit or reorder one that has been released: the start-up check refuses a database whose recorded checksum no longer matches.
 *  3. Keep each change additive where you can (new table, new nullable column). Add a matching line to SCHEMA only if a brand-new database should get it from the baseline too —
 *     otherwise the migration alone creates it. Do not do both.
 *
 * Example (not active):
 *   { version: 2, name: 'users_last_login', sql: 'ALTER TABLE users ADD COLUMN last_login_at TEXT' },
 */
export const MIGRATIONS: Migration[] = [];
