import { kv } from '@vercel/kv';
import type { LeaderboardEntry, ScoreRank } from '../types.js';

const LEADERBOARD_KEY = 'gitscore:leaderboard';

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

export async function saveToLeaderboard(profile: ProfileTelemetry): Promise<void> {
  const entry: LeaderboardEntry = {
    login: profile.login,
    name: profile.name,
    avatar_url: profile.avatar_url,
    score: profile.score,
    rank: profile.rank,
    badgesEarned: profile.badgesEarned,
    totalStars: profile.totalStars,
    followers: profile.followers,
    analyzedAtMs: Date.now(),
  };

  await kv.zadd(LEADERBOARD_KEY, { score: profile.score, member: entry.login });
  await kv.hset(`${LEADERBOARD_KEY}:meta`, { [profile.login]: entry });
}

export interface LeaderboardQueryResult {
  entries: LeaderboardEntry[];
  total: number;
}

export async function getLeaderboard(limit: number = 10): Promise<LeaderboardQueryResult> {
  const rawMembers = await kv.zrange(LEADERBOARD_KEY, 0, limit - 1, { rev: true });
  if (!rawMembers || rawMembers.length === 0) {
    return { entries: [], total: 0 };
  }

  const logins: string[] = rawMembers as string[];
  const meta = await kv.hmget(`${LEADERBOARD_KEY}:meta`, ...logins);

  const entries: LeaderboardEntry[] = [];
  for (const login of logins) {
    const m = meta?.[login] as LeaderboardEntry | undefined;
    if (m) entries.push(m);
  }

  const total = await kv.zcard(LEADERBOARD_KEY);
  return { entries, total: total ?? 0 };
}

export async function getEntry(login: string): Promise<LeaderboardEntry | null> {
  const m = await kv.hget(`${LEADERBOARD_KEY}:meta`, login);
  return (m as LeaderboardEntry | undefined) ?? null;
}