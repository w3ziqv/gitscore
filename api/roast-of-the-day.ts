// api/roast-of-the-day.ts — GET /api/roast-of-the-day
//
// Picks one (login, roast) pair that was analyzed today and is "funny
// enough" by a simple heuristic:
//   - prefer roasts with many long lines (more punchlines = funnier)
//   - tie-break by recency (most recent analyzed_at_ms)
//   - falls back to a deterministic rotation from the leaderboard if no roasts
//     have been analyzed today.
//
// The endpoint never errors — it returns a 200 with `null` payload when nobody
// has been roasted yet, so the homepage card stays graceful.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchProfile } from './_lib/github.js';
import { generateRoastWithLang } from '../src/lib/roast.js';
import { isDbConfigured, ensureSchema, sql } from '../src/lib/db.js';
import { getLeaderboard } from '../src/lib/leaderboard.js';
import type { RoastResult } from '../src/types.js';

interface RoastOfDayResponse {
  login: string;
  avatar_url: string;
  roast: RoastResult;
  generatedAtMs: number;
}

function scoreLines(lines: string[]): number {
  // Funny heuristic: long lines (≥40 chars) score more; very short ones barely.
  return lines.reduce(
    (acc, l) => acc + Math.min(8, Math.max(0, l.length - 20) / 10),
    0,
  );
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  if (_req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    if (!isDbConfigured()) {
      res.status(200).json(null);
      return;
    }

    await ensureSchema();
    const s = sql();
    const sinceMs = Date.now() - 24 * 60 * 60 * 1000;

    // Pull recent analyzed profiles from leaderboard; roast each one fresh and
    // pick the funniest by line-score + recency.
    const recent = (await s`
      SELECT login, avatar_url, score, analyzed_at_ms
      FROM leaderboard
      WHERE analyzed_at_ms > ${sinceMs}
      ORDER BY analyzed_at_ms DESC
      LIMIT 12
    `) as { login: string; avatar_url: string; score: number; analyzed_at_ms: number }[];

    if (recent.length === 0) {
      // Fallback: rotate the top of the global leaderboard.
      const { entries } = await getLeaderboard(5);
      if (entries.length === 0) {
        res.status(200).json(null);
        return;
      }
      const dayIndex = Math.floor(Date.now() / (24 * 60 * 60 * 1000));
      const chosen = entries[dayIndex % entries.length];
      const analysis = await fetchProfile(chosen.login);
      const roast = generateRoastWithLang(analysis.user, analysis.repos, analysis.score, 'en');
      const payload: RoastOfDayResponse = {
        login: chosen.login,
        avatar_url: chosen.avatar_url,
        roast,
        generatedAtMs: Date.now(),
      };
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.status(200).json(payload);
      return;
    }

    let best: RoastOfDayResponse | null = null;
    let bestScore = -1;
    for (const r of recent) {
      try {
        const a = await fetchProfile(r.login);
        const roast = generateRoastWithLang(a.user, a.repos, a.score, 'en');
        const sc = scoreLines(roast.lines) + r.analyzed_at_ms / 1e12;
        if (sc > bestScore) {
          bestScore = sc;
          best = {
            login: r.login,
            avatar_url: r.avatar_url,
            roast,
            generatedAtMs: r.analyzed_at_ms,
          };
        }
      } catch {
        // skip user fetch failures
      }
    }

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.status(200).json(best);
  } catch (err) {
    console.error('roast-of-the-day error:', err);
    res.status(200).json(null);
  }
}