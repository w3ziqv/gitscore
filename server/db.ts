// server/db.ts — SQLite database for caching GitHub API responses + leaderboard
// Uses Node.js built-in node:sqlite (available in Node 22+)

import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('gitscore.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    username TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    cached_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS leaderboard (
    username TEXT PRIMARY KEY,
    score INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

const CACHE_TTL_MS = 1000 * 60 * 30;

export interface CacheEntry {
  username: string;
  data: string;
  cached_at: number;
}

export function getCached(username: string): CacheEntry | null {
  const stmt = db.prepare('SELECT username, data, cached_at FROM cache WHERE username = ?');
  const row = stmt.get(username) as CacheEntry | undefined;
  if (!row) return null;

  if (Date.now() - row.cached_at > CACHE_TTL_MS) {
    db.prepare('DELETE FROM cache WHERE username = ?').run(username);
    return null;
  }

  return row;
}

export function setCached(username: string, data: string): void {
  db.prepare(
    'INSERT OR REPLACE INTO cache (username, data, cached_at) VALUES (?, ?, ?)'
  ).run(username, data, Date.now());
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  updated_at: number;
}

export function upsertLeaderboard(username: string, score: number): void {
  db.prepare(
    'INSERT OR REPLACE INTO leaderboard (username, score, updated_at) VALUES (?, ?, ?)'
  ).run(username, score, Date.now());
}

export function getLeaderboard(limit: number = 10): LeaderboardEntry[] {
  const stmt = db.prepare('SELECT username, score, updated_at FROM leaderboard ORDER BY score DESC LIMIT ?');
  return stmt.all(limit) as unknown as LeaderboardEntry[];
}
