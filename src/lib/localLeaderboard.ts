import type { LeaderboardEntry, ProfileAnalysis } from '../types.js';
import { getScoreRank } from './score.js';

const KEY = 'gitscore:local-leaderboard';
const MAX = 50;

export function readLocalLeaderboard(): LeaderboardEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LeaderboardEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(e => e && typeof e.login === 'string');
  } catch {
    return [];
  }
}

export function saveLocalLeaderboardEntry(analysis: ProfileAnalysis): void {
  if (typeof window === 'undefined') return;
  try {
    const rank = getScoreRank(analysis.score.total);
    const entry: LeaderboardEntry = {
      login: analysis.user.login,
      name: analysis.user.name,
      avatar_url: analysis.user.avatar_url,
      score: analysis.score.total,
      rank: rank.rank,
      badgesEarned: analysis.badges.filter(b => b.earned).length,
      totalStars: analysis.totalStars,
      followers: analysis.user.followers,
      analyzedAtMs: Date.now(),
    };
    const existing = readLocalLeaderboard().filter(e => e.login !== entry.login);
    const updated = [entry, ...existing]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable (private mode, quota) — silent no-op
  }
}

export function mergeLeaderboards(
  server: LeaderboardEntry[],
  local: LeaderboardEntry[],
  limit: number = 10,
): LeaderboardEntry[] {
  const seen = new Set<string>();
  const merged: LeaderboardEntry[] = [];
  for (const e of [...server, ...local].sort((a, b) => b.score - a.score)) {
    if (seen.has(e.login)) continue;
    seen.add(e.login);
    merged.push(e);
    if (merged.length >= limit) break;
  }
  return merged;
}