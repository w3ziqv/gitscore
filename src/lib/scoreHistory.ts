// src/lib/scoreHistory.ts — F5 — score sparkline persistence helpers.
//
// A single "snapshot" per (login, ISO day) is enough for a sparkline that
// spans ~30d. `bucketIsoDay` is YYYYMMDD in UTC. The unique index guarantees
// one row/day per login, so `upsertSnapshot` is idempotent (multiple profile
// fetches on the same UTC day just refresh the same row).
//
// All functions degrade gracefully: silent no-op when the DB is not
// configured. The frontend then renders an absent sparkline.

import { sql, ensureSchema, isDbConfigured } from './db.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export function todayBucket(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

export function bucketToIso(bucket: string): string {
  // 20260720 → 2026-07-20
  return `${bucket.slice(0, 4)}-${bucket.slice(4, 6)}-${bucket.slice(6, 8)}`;
}

export function isoToBucket(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '');
}

/**
 * Insert (or refresh in-place) today's score for `login`. Idempotent per UTC
 * day via the unique index on `(login, bucket_iso_day)`.
 */
export async function upsertSnapshot(login: string, score: number): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await ensureSchema();
    const s = sql();
    const bucket = todayBucket();
    const capturedAtMs = Date.now();
    await s`
      INSERT INTO score_history (login, score, bucket_iso_day, captured_at_ms)
      VALUES (${login}, ${score}, ${bucket}, ${capturedAtMs})
      ON CONFLICT (login, bucket_iso_day) DO UPDATE SET
        score = EXCLUDED.score,
        captured_at_ms = EXCLUDED.captured_at_ms
    `;
  } catch (err) {
    console.error('score_history upsert failed:', err);
  }
}

/**
 * Fetch the most recent `days` score snapshots for `login`, oldest-first.
 * Returns `[]` when DB is not configured or the user has no history.
 */
export async function getLastNDays(login: string, days: number = 30): Promise<number[]> {
  if (!isDbConfigured()) return [];
  try {
    await ensureSchema();
    const s = sql();
    const rows = (await s`
      SELECT score
      FROM score_history
      WHERE login = ${login}
      ORDER BY captured_at_ms DESC
      LIMIT ${Math.max(1, Math.min(days, 365))}
    `) as { score: number }[];
    return rows.reverse().map(r => r.score);
  } catch (err) {
    console.error('score_history fetch failed:', err);
    return [];
  }
}

/**
 * Compute a 7-day / 30-day score delta for `login` using the closest
 * snapshots before `now - windowDays` and now. Returns 0 if not enough
 * history. Negative `delta` is rare (only when score drops).
 */
export async function getDelta(login: string, windowDays: number): Promise<number> {
  if (!isDbConfigured()) return 0;
  try {
    await ensureSchema();
    const s = sql();
    const windowMs = windowDays * DAY_MS;
    const now = Date.now();
    const windowBoundary = now - windowMs;
    const boundaryRows = (await s`
      SELECT score
      FROM score_history
      WHERE login = ${login} AND captured_at_ms < ${windowBoundary}
      ORDER BY captured_at_ms DESC
      LIMIT 1
    `) as { score: number }[];
    const recentRows = (await s`
      SELECT score
      FROM score_history
      WHERE login = ${login}
      ORDER BY captured_at_ms DESC
      LIMIT 1
    `) as { score: number }[];
    if (boundaryRows.length === 0 || recentRows.length === 0) return 0;
    return recentRows[0].score - boundaryRows[0].score;
  } catch (err) {
    console.error('score_history delta failed:', err);
    return 0;
  }
}

/**
 * Compute deltas for several logins in one query (single round-trip). Used by
 * the most-improved leaderboard tab (F6). Returns a map login -> deltaPts.
 */
export async function getDeltas(
  logins: string[],
  windowDays: number,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (!isDbConfigured() || logins.length === 0) return result;
  try {
    await ensureSchema();
    const s = sql();
    const windowMs = windowDays * DAY_MS;
    const now = Date.now();
    const boundary = now - windowMs;
    const rows = (await s`
      WITH ranked AS (
        SELECT
          login,
          score,
          captured_at_ms,
          ROW_NUMBER() OVER (PARTITION BY login ORDER BY captured_at_ms DESC) AS rn_recent,
          ROW_NUMBER() OVER (
            PARTITION BY login
            ORDER BY CASE WHEN captured_at_ms < ${boundary} THEN 0 ELSE 1 END,
                     captured_at_ms DESC
          ) AS rn_boundary
        FROM score_history
        WHERE login = ANY(${logins}::text[])
      ),
      recent AS (
        SELECT login, score FROM ranked WHERE rn_recent = 1
      ),
      past AS (
        SELECT login, score FROM ranked
        WHERE captured_at_ms < ${boundary}
          AND rn_boundary = 1
      )
      SELECT recent.login, recent.score AS now_score, past.score AS past_score
      FROM recent LEFT JOIN past ON recent.login = past.login
    `) as { login: string; now_score: number; past_score: number | null }[];
    for (const r of rows) {
      if (r.past_score != null) result.set(r.login, r.now_score - r.past_score);
    }
    return result;
  } catch (err) {
    console.error('score_history deltas failed:', err);
    return result;
  }
}