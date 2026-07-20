// src/lib/db.ts — Neon Postgres client for GitScore (serverless-friendly HTTP driver).
//
// Owns the schema for:
//   - leaderboard          (live since README rev 2)
//   - score_history        (F5 — daily snapshot per login for sparkline + improved-tab)
//   - threshold_subs       (F10 — inbound webhook subscriptions on score-cross)

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

let schemaInitialized = false;

/**
 * Idempotently ensures all three tables + indexes exist. Cheap to call on every
 * cold start because of `IF NOT EXISTS`. The Neon HTTP driver does not support
 * multi-statement prepared statements, so DDL is split across separate `sql`
 * calls.
 */
export async function ensureSchema(): Promise<void> {
  if (schemaInitialized) return;
  const s = sql();

  await s`
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
    )
  `;
  await s`
    CREATE INDEX IF NOT EXISTS leaderboard_score_idx ON leaderboard (score DESC)
  `;

  // F5 — daily score snapshots for sparkline + most-improved tab.
  await s`
    CREATE TABLE IF NOT EXISTS score_history (
      login            TEXT NOT NULL,
      score            INTEGER NOT NULL,
      bucket_iso_day   CHAR(8) NOT NULL,
      captured_at_ms   BIGINT NOT NULL
    )
  `;
  await s`
    CREATE UNIQUE INDEX IF NOT EXISTS score_history_day_uniq
      ON score_history (login, bucket_iso_day)
  `;
  await s`
    CREATE INDEX IF NOT EXISTS score_history_login_captured_idx
      ON score_history (login, captured_at_ms DESC)
  `;

  // F10 — threshold subscriptions. `threshold` is the score, `webhook_url` is
  // where we POST `{login, score, threshold, ts}` when the score crosses it.
  await s`
    CREATE TABLE IF NOT EXISTS threshold_subs (
      id           BIGSERIAL PRIMARY KEY,
      login        TEXT NOT NULL,
      threshold    INTEGER NOT NULL,
      webhook_url  TEXT NOT NULL,
      token        TEXT NOT NULL,
      fired_at_ms  BIGINT,
      created_at_ms BIGINT NOT NULL
    )
  `;
  await s`
    CREATE INDEX IF NOT EXISTS threshold_subs_login_idx ON threshold_subs (login)
  `;

  schemaInitialized = true;
}