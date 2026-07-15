// src/lib/leaderboard.ts — Neon Postgres-backed leaderboard persistence

import { sql, ensureSchema, isDbConfigured } from './db.js';
import type { LeaderboardEntry, ScoreRank } from '../types.js';

/**
 * Shape of the data the /api/profile/:username endpoint emits after analyzing
 * a GitHub profile. Decoupled from `LeaderboardEntry` so the API does not have
 * to invent an `analyzedAtMs` timestamp itself.
 */
export interface ProfileTelemetry {
  login: string;
  name: string | null;
  avatar_url: string;
  score: number;
  rank: ScoreRank;
  badgesEarned: number;
  totalStars: number;
  followers: number;
}

export interface LeaderboardQueryResult {
  entries: LeaderboardEntry[];
  total: number;
}

/** Row shape returned by the Neon select, with Postgres column aliases applied. */
interface LeaderboardRow {
  login: string;
  name: string | null;
  avatar_url: string;
  score: number;
  rank: ScoreRank;
  badgesEarned: number;
  totalStars: number;
  followers: number;
  analyzedAtMs: number;
}



/**
 * Upsert a profile into the leaderboard. Safe to call on every profile fetch —
 * `ON CONFLICT (login) DO UPDATE` refreshes score + metadata.
 *
 * Silently no-ops when `DATABASE_URL` is not configured so the local-dev
 * localStorage fallback remains the source of truth.
 */
export async function saveToLeaderboard(profile: ProfileTelemetry): Promise<void> {
  console.log('saveToLeaderboard: isDbConfigured=', isDbConfigured(), 'DATABASE_URL present=', Boolean(process.env.DATABASE_URL), 'len=', process.env.DATABASE_URL?.length ?? 0, 'prefix=', process.env.DATABASE_URL?.slice(0, 30) ?? '(none)');
  if (!isDbConfigured()) return;

  try {
    await ensureSchema();
    const s = sql();
    const analyzedAtMs = Date.now();
    await s`
      INSERT INTO leaderboard
        (login, name, avatar_url, score, rank, badges_earned, total_stars, followers, analyzed_at_ms)
      VALUES
        (${profile.login}, ${profile.name}, ${profile.avatar_url}, ${profile.score},
         ${profile.rank}, ${profile.badgesEarned}, ${profile.totalStars},
         ${profile.followers}, ${analyzedAtMs})
      ON CONFLICT (login) DO UPDATE SET
        name           = EXCLUDED.name,
        avatar_url     = EXCLUDED.avatar_url,
        score          = EXCLUDED.score,
        rank           = EXCLUDED.rank,
        badges_earned  = EXCLUDED.badges_earned,
        total_stars    = EXCLUDED.total_stars,
        followers      = EXCLUDED.followers,
        analyzed_at_ms = EXCLUDED.analyzed_at_ms
    `;
  } catch (err) {
    // Never let persistence errors crash the profile endpoint —
    // localStorage fallback still produces a useful leaderboard.
    console.error('leaderboard save failed:', err);
  }
}

/**
 * Fetch up to `limit` top entries by score.
 * Returns `{ entries: [], total: 0 }` when the DB is not configured so the
 * frontend merge logic collapses to the localStorage-only path.
 */
export async function getLeaderboard(limit: number = 10): Promise<LeaderboardQueryResult> {
  console.log('getLeaderboard: isDbConfigured=', isDbConfigured(), 'DATABASE_URL present=', Boolean(process.env.DATABASE_URL));
  if (!isDbConfigured()) {
    return { entries: [], total: 0 };
  }

  try {
    await ensureSchema();
    const s = sql();
    const rows = (await s`
      SELECT
        login, name, avatar_url, score, rank,
        badges_earned AS "badgesEarned",
        total_stars   AS "totalStars",
        followers,
        analyzed_at_ms AS "analyzedAtMs"
      FROM leaderboard
      ORDER BY score DESC
      LIMIT ${limit}
    `) as LeaderboardRow[];

    const countRows = (await s`SELECT COUNT(*)::int AS total FROM leaderboard`) as { total: number }[];
    const total = countRows[0]?.total ?? rows.length;

    return { entries: rows.map(toLeaderboardEntry), total };
  } catch (err) {
    console.error('leaderboard fetch failed:', err);
    return { entries: [], total: 0 };
  }
}

/** Fetch a single entry by login. Returns `null` if missing or DB not configured. */
export async function getEntry(login: string): Promise<LeaderboardEntry | null> {
  if (!isDbConfigured()) return null;

  try {
    await ensureSchema();
    const s = sql();
    const rows = (await s`
      SELECT
        login, name, avatar_url, score, rank,
        badges_earned AS "badgesEarned",
        total_stars   AS "totalStars",
        followers,
        analyzed_at_ms AS "analyzedAtMs"
      FROM leaderboard
      WHERE login = ${login}
    `) as LeaderboardRow[];
    return rows[0] ? toLeaderboardEntry(rows[0]) : null;
  } catch (err) {
    console.error('leaderboard getEntry failed:', err);
    return null;
  }
}

function toLeaderboardEntry(row: LeaderboardRow): LeaderboardEntry {
  return {
    login: row.login,
    name: row.name,
    avatar_url: row.avatar_url,
    score: row.score,
    rank: row.rank,
    badgesEarned: row.badgesEarned,
    totalStars: row.totalStars,
    followers: row.followers,
    analyzedAtMs: row.analyzedAtMs,
  };
}