// src/worker.ts — Cloudflare Workers entry (Hono) reproducing the old /api contract.

import { Hono } from 'hono';
import { fetchProfile, errorStatusAndBody } from './lib/github.js';
import { getScoreRank } from './lib/score.js';
import { generateBadgeSvg } from './lib/badge.js';
import { generateRoastWithLang, parseAcceptLanguage } from './lib/roast.js';
import { parseGitHubEvents } from './lib/activity.js';
import { getLeaderboard, getImprovedLeaderboard, saveToLeaderboard } from './lib/leaderboard.js';
import { upsertSnapshot, getLastNDays } from './lib/scoreHistory.js';
import { ensureSchema, sql, isDbConfigured } from './lib/db.js';
import {
  extractBearer,
  isBearerTokenValid,
  isSafeWebhookUrl,
  buildThresholdPayload,
  fireWebhook,
} from './lib/webhook.js';
import { buildWrappedReport } from './lib/wrapped.js';
import { generateWrappedCardSvg } from './lib/wrappedCard.js';
import type { RoastResult } from './types.js';

interface WorkerFetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface WorkerScheduledEvent {
  cron: string;
  scheduledTime: number;
  type: string;
}

interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

type Env = {
  ASSETS?: WorkerFetcher;
  GITHUB_TOKEN?: string;
  DATABASE_URL?: string;
  WEBHOOK_SUB_TOKEN?: string;
  SITE_URL?: string;
  AI?: {
    run(
      model: string,
      input: {
        messages: Array<{ role: string; content: string }>;
        max_tokens?: number;
      },
    ): Promise<{ response?: string }> | Promise<string>;
  };
};

const app = new Hono<{ Bindings: Env }>();

// ── Rate limiter (token bucket / fixed window per IP) ───────────────────────

interface Bucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 60;
const STRICT_LIMIT = 20;

function clientIp(c: { req: { header: (n: string) => string | undefined } }): string {
  return c.req.header('CF-Connecting-IP') ?? 'unknown';
}

function takeToken(ip: string, limit: number): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const key = `${ip}:${limit}`;
  let b = rateBuckets.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    rateBuckets.set(key, b);
  }
  if (b.count >= limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true };
}

function isStrictPath(path: string): boolean {
  return (
    path.startsWith('/api/profile') ||
    path.startsWith('/api/compare') ||
    path.startsWith('/api/webhook/threshold')
  );
}

// Security headers on all /api/*
app.use('/api/*', async (c, next) => {
  const ip = clientIp(c);
  const path = new URL(c.req.url).pathname;
  const limit = isStrictPath(path) ? STRICT_LIMIT : DEFAULT_LIMIT;
  const result = takeToken(ip, limit);
  if (!result.ok) {
    c.header('Retry-After', String(result.retryAfter));
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    return c.json({ error: 'Too many requests' }, 429);
  }
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

function jsonError(c: { json: (b: unknown, s?: number) => Response }, error: unknown): Response {
  const { status, body } = errorStatusAndBody(error);
  return c.json(body, status as 400 | 404 | 429 | 500);
}

// ── GET /api/health ─────────────────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ status: 'ok' }));

// ── GET /api/leaderboard ────────────────────────────────────────────────────

app.get('/api/leaderboard', async (c) => {
  const limitParam = c.req.query('limit');
  const limit = Math.min(Math.max(parseInt(limitParam ?? '10', 10) || 10, 1), 100);
  const tab = c.req.query('tab') ?? 'global';
  const windowParam = c.req.query('window') ?? '7';
  const windowDays = Math.min(Math.max(parseInt(windowParam ?? '7', 10) || 7, 1), 90);

  try {
    if (tab === 'improved') {
      const result = await getImprovedLeaderboard(limit, windowDays);
      c.header('Cache-Control', 'public, max-age=60');
      return c.json(result);
    }
    const result = await getLeaderboard(limit);
    c.header('Cache-Control', 'public, max-age=60');
    return c.json(result);
  } catch (err) {
    console.error('leaderboard error:', err);
    return c.json({ entries: [], total: 0 });
  }
});

// ── GET /api/roast-of-the-day ───────────────────────────────────────────────

interface RoastOfDayResponse {
  login: string;
  avatar_url: string;
  roast: RoastResult;
  generatedAtMs: number;
}

function scoreLines(lines: string[]): number {
  return lines.reduce(
    (acc, l) => acc + Math.min(8, Math.max(0, l.length - 20) / 10),
    0,
  );
}

app.get('/api/roast-of-the-day', async (c) => {
  try {
    if (!isDbConfigured()) {
      return c.json(null);
    }

    await ensureSchema();
    const s = sql();
    const sinceMs = Date.now() - 24 * 60 * 60 * 1000;

    const recent = (await s`
      SELECT login, avatar_url, score, analyzed_at_ms
      FROM leaderboard
      WHERE analyzed_at_ms > ${sinceMs}
      ORDER BY analyzed_at_ms DESC
      LIMIT 12
    `) as { login: string; avatar_url: string; score: number; analyzed_at_ms: number }[];

    if (recent.length === 0) {
      const { entries } = await getLeaderboard(5);
      if (entries.length === 0) {
        return c.json(null);
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
      c.header('Cache-Control', 'public, max-age=300');
      return c.json(payload);
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

    c.header('Cache-Control', 'public, max-age=300');
    return c.json(best);
  } catch (err) {
    console.error('roast-of-the-day error:', err);
    return c.json(null);
  }
});

// ── GET /api/activity/:username ─────────────────────────────────────────────

interface RawGitHubEvent {
  id: string;
  type: string;
  repo: { name: string };
  created_at: string;
  payload?: Record<string, unknown>;
  actor?: { login: string };
}

const EVENTS_LIMIT = 30;

app.get('/api/activity/:username', async (c) => {
  const username = c.req.param('username');
  if (!username) {
    return c.json({ error: 'Username is required' }, 400);
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'gitscore',
    };
    const token = process.env.GITHUB_TOKEN;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/events?per_page=${EVENTS_LIMIT}`,
      { headers },
    );

    if (response.status === 404) {
      return c.json({ error: 'User not found' }, 404);
    }
    if (!response.ok) {
      return c.json({ error: 'Failed to fetch activity from GitHub' }, response.status as 400 | 500);
    }

    const events = (await response.json()) as RawGitHubEvent[];
    const parsed = parseGitHubEvents(events, 8);
    return c.json(parsed);
  } catch (err) {
    console.error('activity error:', err);
    return c.json({ error: 'Failed to fetch activity' }, 500);
  }
});

// ── GET /api/badge/:username ────────────────────────────────────────────────

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function badgeError(login: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="44" viewBox="0 0 220 44" shape-rendering="crispEdges">
  <rect x="0" y="0" width="220" height="44" fill="#0e0e0e" stroke="#f0f0fa" stroke-width="1"/>
  <rect x="2" y="2" width="6" height="40" fill="#484f58"/>
  <text x="14" y="14" font-family="monospace" font-size="9" font-weight="700" fill="#9d9d9d" letter-spacing="2"># GITSCORE</text>
  <text x="14" y="34" font-family="monospace" font-size="13" font-weight="700" fill="#f0f0fa">${escapeXml(login || 'unknown')}</text>
  <text x="160" y="14" font-family="monospace" font-size="9" font-weight="700" fill="#9d9d9d" letter-spacing="2">RANK</text>
  <text x="160" y="34" font-family="monospace" font-size="14" font-weight="700" fill="#484f58">?</text>
  <text x="190" y="14" font-family="monospace" font-size="9" font-weight="700" fill="#9d9d9d" letter-spacing="2">SCORE</text>
  <text x="190" y="34" font-family="monospace" font-size="14" font-weight="700" fill="#f0f0fa">N/A</text>
</svg>`;
}

app.get('/api/badge/:username', async (c) => {
  const username = c.req.param('username') ?? '';
  if (!username) {
    c.header('Content-Type', 'image/svg+xml');
    return c.body(badgeError('Username required'), 400);
  }

  const themeQ = c.req.query('theme') ?? 'light';
  const theme: 'light' | 'dark' = themeQ === 'dark' ? 'dark' : 'light';

  try {
    const analysis = await fetchProfile(username);
    const rank = getScoreRank(analysis.score.total);
    const svg = generateBadgeSvg({
      login: analysis.user.login,
      score: analysis.score.total,
      rank: rank.rank,
      theme,
    });
    c.header('Content-Type', 'image/svg+xml');
    c.header('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    c.header('Vary', 'Accept-Encoding');
    return c.body(svg, 200);
  } catch (error) {
    console.error('badge error:', error);
    c.header('Content-Type', 'image/svg+xml');
    c.header('Cache-Control', 'public, max-age=60');
    return c.body(badgeError(username), 200);
  }
});

// ── GET /api/compare/:user1/:user2 ──────────────────────────────────────────

app.get('/api/compare/:user1/:user2', async (c) => {
  const user1 = c.req.param('user1');
  const user2 = c.req.param('user2');
  if (!user1 || !user2) {
    return c.json({ error: 'Two usernames required' }, 400);
  }

  try {
    const [analysis1, analysis2] = await Promise.all([fetchProfile(user1), fetchProfile(user2)]);
    return c.json({ user1: analysis1, user2: analysis2 });
  } catch (error) {
    return jsonError(c, error);
  }
});

// ── GET /api/profile/:username ──────────────────────────────────────────────

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

    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (const sub of subs) {
      if (sub.threshold < 0 || sub.threshold > 1000) continue;
      if (nowScore < sub.threshold) continue;
      if (sub.fired_at_ms !== null && now - sub.fired_at_ms < DAY_MS) continue;

      const payload = buildThresholdPayload({
        login,
        score: nowScore,
        threshold: sub.threshold,
        firedAtMs: now,
      });

      const fired = await fireWebhook(sub.webhook_url, payload);
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

app.get('/api/profile/:username', async (c) => {
  const username = c.req.param('username');
  if (!username) {
    return c.json({ error: 'Username required' }, 400);
  }
  if (!/^[a-z0-9_-]{1,39}$/i.test(username)) {
    return c.json({ error: 'Invalid username' }, 400);
  }

  try {
    const analysis = await fetchProfile(username);
    const rank = getScoreRank(analysis.score.total);
    const badgesEarned = analysis.badges.filter((b) => b.earned).length;

    // Background persistence via waitUntil so Workers keep the isolate alive.
    const background = (async () => {
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

      try {
        await fireThresholdSubs(analysis.user.login, analysis.score.total);
      } catch (err) {
        console.error('threshold fire failed:', err);
      }
    })().catch((err) => console.error('background pipeline failed:', err));

    try {
      c.executionCtx.waitUntil(background);
    } catch {
      // executionCtx may be missing under some test harnesses
      void background;
    }

    return c.json(analysis);
  } catch (error) {
    return jsonError(c, error);
  }
});

// ── GET /api/roast/:username ────────────────────────────────────────────────

app.get('/api/roast/:username', async (c) => {
  const username = c.req.param('username');
  if (!username) {
    return c.json({ error: 'Username required' }, 400);
  }

  const langQ = c.req.query('lang') ?? '';
  const acceptLang = c.req.header('Accept-Language');
  const lang = langQ || parseAcceptLanguage(acceptLang);

  try {
    const analysis = await fetchProfile(username);
    const roast = generateRoastWithLang(analysis.user, analysis.repos, analysis.score, lang);
    return c.json({ ...roast, lang });
  } catch (error) {
    return jsonError(c, error);
  }
});

// ── GET /api/score-history/:username ────────────────────────────────────────

app.get('/api/score-history/:username', async (c) => {
  const username = c.req.param('username');
  if (!username) {
    return c.json({ error: 'Username required' }, 400);
  }
  const daysParam = c.req.query('days') ?? '14';
  const days = Math.min(Math.max(parseInt(daysParam ?? '14', 10) || 14, 1), 90);

  try {
    const history = await getLastNDays(username, days);
    c.header('Cache-Control', 'public, max-age=60');
    return c.json({ history });
  } catch (err) {
    console.error('score-history error:', err);
    return c.json({ history: [] });
  }
});

// ── GET /api/wrapped/:username ──────────────────────────────────────────────

app.get('/api/wrapped/:username', async (c) => {
  const username = c.req.param('username');
  if (!username) {
    return c.json({ error: 'Username required' }, 400);
  }
  if (!/^[a-z0-9_-]{1,39}$/i.test(username)) {
    return c.json({ error: 'Invalid username' }, 400);
  }

  try {
    const report = await buildWrappedReport(username, {
      GITHUB_TOKEN: c.env?.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN,
      AI: c.env?.AI,
    });
    c.header('Cache-Control', 'public, max-age=1800');
    return c.json({ report });
  } catch (error) {
    return jsonError(c, error);
  }
});

// ── GET /api/wrapped-card/:username ─────────────────────────────────────────

app.get('/api/wrapped-card/:username', async (c) => {
  const username = c.req.param('username');
  if (!username) {
    return c.json({ error: 'Username required' }, 400);
  }
  if (!/^[a-z0-9_-]{1,39}$/i.test(username)) {
    return c.json({ error: 'Invalid username' }, 400);
  }

  try {
    const report = await buildWrappedReport(username, {
      GITHUB_TOKEN: c.env?.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN,
      AI: c.env?.AI,
    });
    const svg = generateWrappedCardSvg(report);
    c.header('Content-Type', 'image/svg+xml');
    c.header('Cache-Control', 'public, max-age=1800');
    return c.body(svg, 200);
  } catch (error) {
    return jsonError(c, error);
  }
});

// ── POST /api/webhook/threshold ─────────────────────────────────────────────

app.post('/api/webhook/threshold', async (c) => {
  if (!isDbConfigured()) {
    return c.json({ error: 'Database not configured. Set DATABASE_URL.' }, 503);
  }

  if (!process.env.WEBHOOK_SUB_TOKEN) {
    return c.json(
      { error: 'Webhook subscriptions are disabled: WEBHOOK_SUB_TOKEN is not set.' },
      503,
    );
  }

  const token = extractBearer(c.req.header('Authorization'));
  if (!isBearerTokenValid(token)) {
    return c.json(
      { error: 'Missing or invalid Authorization Bearer (must match WEBHOOK_SUB_TOKEN).' },
      401,
    );
  }

  let body: { login?: unknown; threshold?: unknown; webhook_url?: unknown };
  try {
    body = (await c.req.json()) as typeof body;
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const login = typeof body.login === 'string' ? body.login.trim().toLowerCase() : '';
  const threshold = typeof body.threshold === 'number' ? Math.floor(body.threshold) : undefined;
  const webhookUrl = typeof body.webhook_url === 'string' ? body.webhook_url.trim() : '';

  if (!/^[a-z0-9_\-]{1,39}$/i.test(login)) {
    return c.json({ error: 'login must be a valid GitHub username' }, 400);
  }
  if (threshold === undefined || threshold < 0 || threshold > 1000) {
    return c.json({ error: 'threshold must be an integer in 0..1000' }, 400);
  }
  if (!webhookUrl.startsWith('https://')) {
    return c.json({ error: 'webhook_url must be an https URL' }, 400);
  }
  if (!(await isSafeWebhookUrl(webhookUrl))) {
    return c.json({ error: 'webhook_url must point to a public https endpoint' }, 400);
  }

  try {
    await ensureSchema();
    const s = sql();
    const now = Date.now();
    const rows = (await s`
      INSERT INTO threshold_subs (login, threshold, webhook_url, token, created_at_ms)
      VALUES (${login}, ${threshold}, ${webhookUrl}, ${token}, ${now})
      RETURNING id
    `) as { id: number }[];
    return c.json({ id: rows[0]?.id, login, threshold, fired: false }, 201);
  } catch (err) {
    console.error('webhook subscribe failed:', err);
    return c.json({ error: 'Failed to create subscription' }, 500);
  }
});

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

app.all('*', async (c) => {
  const assets = c.env.ASSETS;
  if (assets) {
    return assets.fetch(c.req.raw);
  }
  return c.text('Not found', 404);
});

// ── Scheduled: refresh top leaderboard profiles daily at 03:00 UTC ──────────

async function runScheduledRefresh(): Promise<void> {
  if (!process.env.GITHUB_TOKEN) {
    console.log('scheduled: skip — GITHUB_TOKEN not set');
    return;
  }

  const { entries } = await getLeaderboard(20);
  for (const entry of entries) {
    try {
      const analysis = await fetchProfile(entry.login);
      const rank = getScoreRank(analysis.score.total);
      const badgesEarned = analysis.badges.filter((b) => b.earned).length;
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
      console.error(`scheduled refresh failed for ${entry.login}:`, err);
    }
  }
}

const worker = {
  fetch: app.fetch,
  async scheduled(
    _event: WorkerScheduledEvent,
    _env: Env,
    ctx: WorkerExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runScheduledRefresh());
  },
};

export default worker;
