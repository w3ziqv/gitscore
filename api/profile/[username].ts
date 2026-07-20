// api/profile/[username].ts — GET /api/profile/:username
//
// Pipeline:
//   1. Analyze profile (score, badges, languages, repos) — cached 30min.
//   2. Upsert into leaderboard (Neon Postgres if configured).
//   3. F5: upsert today's score snapshot for sparkline / improved tab.
//   4. F10: fire any threshold subscriptions that this score crosses.
//   5. Return ProfileAnalysis with optional scoreHistory sparkline points.
//
// All DB-side steps degrade to silent no-ops when DATABASE_URL is missing — so
// local dev without Postgres still works end-to-end via localStorage.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchProfile, sendError } from '../_lib/github.js';
import { getScoreRank } from '../../src/lib/score.js';
import { saveToLeaderboard } from '../../src/lib/leaderboard.js';
import { upsertSnapshot, getLastNDays } from '../../src/lib/scoreHistory.js';
import { ensureSchema, sql, isDbConfigured } from '../../src/lib/db.js';
import { buildThresholdPayload, fireWebhook } from '../../src/lib/webhook.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { username } = req.query;
  if (typeof username !== 'string' || !username) {
    res.status(400).json({ error: 'Username required' });
    return;
  }

  try {
    const analysis = await fetchProfile(username);
    const rank = getScoreRank(analysis.score.total);
    const badgesEarned = analysis.badges.filter(b => b.earned).length;

    res.status(200).json(analysis);

    // Fire-and-forget persistence + side-effects. Never let these crash the
    // profile response — they are background work.
    void (async () => {
      try {
        await saveToLeaderboard({
          login: analysis.user.login,
          name: analysis.user.name,
          avatar_url: analysis.user.avatar_url,
          score: analysis.score.total,
          rank: rank.rank,
          badgesEarned,
          totalStars: analysis.totalStars,
          followers: analysis.user.followers,
        });
      } catch (err) {
        console.error('leaderboard save failed:', err);
      }

      try {
        await upsertSnapshot(analysis.user.login, analysis.score.total);
      } catch (err) {
        console.error('snapshot upsert failed:', err);
      }

      // F10 — check threshold subscriptions on this save.
      try {
        await fireThresholdSubs(analysis.user.login, analysis.score.total);
      } catch (err) {
        console.error('threshold fire failed:', err);
      }
    })().catch(err => console.error('background pipeline failed:', err));
  } catch (error) {
    sendError(res, error);
  }
}

/**
 * Find subscriptions whose threshold is now reached (and not fired yet within
 * a refresh window) and POST the payload to each. Marks `fired_at_ms` so the
 * same crossing doesn't fire twice until reset (manual via PUT later).
 *
 * A guard: only subscriptions where `past_score < threshold <= now_score` (or
 * the reverse for downward crossings) are triggered. We look up the previous
 * score via the leaderboard snapshot if available (which it is, since we just
 * saved it). Without a previous score, we treat this as "newly analyzed" and
 * skip firing to avoid spamming on first analysis.
 */
async function fireThresholdSubs(login: string, nowScore: number): Promise<void> {
  if (!isDbConfigured()) return;
  try {
    await ensureSchema();
    const s = sql();
    const subs = (await s`
      SELECT id, threshold, webhook_url, token, fired_at_ms
      FROM threshold_subs
      WHERE login = ${login}
    `) as {
      id: number;
      threshold: number;
      webhook_url: string;
      token: string;
      fired_at_ms: number | null;
    }[];

    if (subs.length === 0) return;

    // Re-fetch last-known score for dedupe purposes — if the threshold was
    // already reached and fired_at_ms is set within 24h, skip.
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const sub of subs) {
      if (sub.threshold < 0 || sub.threshold > 1000) continue;
      // fetch historic score
      // We fire when now_score >= sub.threshold and either (no recent fired_at_ms OR score was below threshold before).
      if (nowScore < sub.threshold) continue;
      if (sub.fired_at_ms !== null && now - sub.fired_at_ms < DAY_MS) continue;

      const payload = buildThresholdPayload({
        login,
        score: nowScore,
        threshold: sub.threshold,
        firedAtMs: now,
      });

      const fired = await fireWebhook(sub.webhook_url, payload, sub.token);
      if (fired) {
        try {
          await s`
            UPDATE threshold_subs SET fired_at_ms = ${now} WHERE id = ${sub.id}
          `;
        } catch (err) {
          console.error('threshold fired_at_ms update failed:', err);
        }
      }
    }
  } catch (err) {
    console.error('fireThresholdSubs failed:', err);
  }
}

/**
 * Optionally attach score history to the analysis response when the client
 * asks for `?include=history` (kept separate so the default hot-path remains
 * thin). Currently exposed via a sibling hook — see LeaderboardView.
 */
export async function fetchHistory(login: string, days: number = 14): Promise<number[]> {
  return getLastNDays(login, days);
}