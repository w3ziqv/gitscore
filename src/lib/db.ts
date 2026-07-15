// src/lib/db.ts — Neon Postgres client for GitScore (serverless-friendly HTTP driver)

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let cached: NeonQueryFunction<false, false> | null = null;

/**
 * Returns the Neon `sql` tagged-template function (cached across warm invocations).
 * Lazily initialized from `process.env.DATABASE_URL` so the browser bundle is not
 * affected by missing env vars.
 *
 * Throws if `DATABASE_URL` is not set — call sites catch and degrade gracefully
 * (the API endpoint returns an empty leaderboard instead of 500ing).
 */
export function sql(): NeonQueryFunction<false, false> {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Configure a Neon Postgres connection string.');
  }
  cached = neon(url);
  return cached;
}

/** True when the Neon connection string is configured. Lets callers short-circuit cleanly. */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS leaderboard (
    login            TEXT PRIMARY KEY,
    name             TEXT,
    avatar_url       TEXT NOT NULL,
    score            INTEGER NOT NULL,
    rank             TEXT NOT NULL,
    badges_earned    INTEGER NOT NULL,
    total_stars      INTEGER NOT NULL,
    followers        INTEGER NOT NULL,
    analyzed_at_ms   BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS leaderboard_score_idx ON leaderboard (score DESC);
`;

let schemaInitialized = false;

/**
 * Idempotently ensures the leaderboard table + index exist.
 * Cheap to call on every cold start because of `IF NOT EXISTS`.
 */
export async function ensureSchema(): Promise<void> {
  if (schemaInitialized) return;
  const s = sql();
  await s(SCHEMA_SQL);
  schemaInitialized = true;
}