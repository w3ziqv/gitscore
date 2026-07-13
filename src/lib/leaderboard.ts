import { Redis } from '@upstash/redis';
import type { LeaderboardEntry, ScoreRank } from '../types.js';

const LEADERBOARD_KEY = 'gitscore:leaderboard';
const META_KEY = 'gitscore:leaderboard:meta';

let cached: Redis | null = null;

function redis(): Redis {
  if (cached) return cached;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set');
  }
  cached = new Redis({ url, token });
  return cached;
}

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

  const r = redis();
  await r.zadd(LEADERBOARD_KEY, { score: profile.score, member: profile.login });
  await r.hset(META_KEY, { [profile.login]: JSON.stringify(entry) });
}

export interface LeaderboardQueryResult {
  entries: LeaderboardEntry[];
  total: number;
}

export async function getLeaderboard(limit: number = 10): Promise<LeaderboardQueryResult> {
  const r = redis();
  const members = await r.zrange(LEADERBOARD_KEY, 0, limit, { rev: true });
  if (!members || members.length === 0) {
    return { entries: [], total: 0 };
  }

  const logins: string[] = members
    .map(m => (typeof m === 'object' && m !== null && 'member' in m ? (m as { member: string }).member : String(m)))
    .filter((v): v is string => typeof v === 'string');

  if (logins.length === 0) {
    return { entries: [], total: 0 };
  }

  const rawMeta = await r.hgetall(META_KEY);
  const entries: LeaderboardEntry[] = [];
  for (const login of logins) {
    const raw = rawMeta?.[login];
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw) as LeaderboardEntry;
        if (parsed && typeof parsed.login === 'string') entries.push(parsed);
      } catch {
        // malformed entry — skip
      }
    }
  }

  const total = await r.zcard(LEADERBOARD_KEY);
  return { entries, total: total ?? 0 };
}

export async function getEntry(login: string): Promise<LeaderboardEntry | null> {
  const r = redis();
  const raw = await r.hget(META_KEY, login);
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as LeaderboardEntry;
  } catch {
    return null;
  }
}