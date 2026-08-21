// src/lib/wrapped.ts — GitScore Wrapped: rolling-365-day activity report

import { fetchProfile } from './github.js';
import { getScoreRank } from './score.js';
import type { GitHubRepo, WrappedReport, WrappedTopRepo } from '../types.js';

const GITHUB_API = 'https://api.github.com';
const CACHE_TTL_MS = 1000 * 60 * 30;
const CACHE_TTL_SECONDS = 60 * 30;
const CACHE_ORIGIN = 'https://github-cache.gitscore.internal';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 365;
const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const AI_VERDICT_MAX = 280;

export interface WrappedEnv {
  GITHUB_TOKEN?: string;
  AI?: {
    run(
      model: string,
      input: {
        messages: Array<{ role: string; content: string }>;
        max_tokens?: number;
      },
    ): Promise<{ response?: string }> | Promise<string>;
  };
}

/** GitHubRepo plus optional created_at (API returns it; shared type omits it). */
type RepoWithCreated = GitHubRepo & { created_at?: string };

interface CacheEntry {
  data: string;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();

function cacheKeyUrl(username: string): string {
  return `${CACHE_ORIGIN}/wrapped/${encodeURIComponent(username.toLowerCase())}`;
}

function getMemoryCached(username: string): WrappedReport | null {
  const key = username.toLowerCase();
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return JSON.parse(entry.data) as WrappedReport;
}

function setMemoryCached(username: string, data: WrappedReport): void {
  memoryCache.set(username.toLowerCase(), {
    data: JSON.stringify(data),
    timestamp: Date.now(),
  });
}

async function getCachedReport(username: string): Promise<WrappedReport | null> {
  try {
    const cacheStorage = (globalThis as { caches?: { default?: Cache } }).caches?.default;
    if (cacheStorage) {
      const req = new Request(cacheKeyUrl(username));
      const hit = await cacheStorage.match(req);
      if (hit) {
        const text = await hit.text();
        return JSON.parse(text) as WrappedReport;
      }
      return null;
    }
  } catch {
    // fall through to memory
  }
  return getMemoryCached(username);
}

async function setCachedReport(username: string, data: WrappedReport): Promise<void> {
  const body = JSON.stringify(data);
  setMemoryCached(username, data);
  try {
    const cacheStorage = (globalThis as { caches?: { default?: Cache } }).caches?.default;
    if (cacheStorage) {
      const req = new Request(cacheKeyUrl(username));
      const res = new Response(body, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
        },
      });
      await cacheStorage.put(req, res);
    }
  } catch {
    // memory already set
  }
}

function clampCount(n: unknown): number {
  const num = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.floor(num));
}

function githubHeaders(token: string | undefined): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GitScore/1.0',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/** Independent search; on any failure returns 0 and marks partial. */
async function searchTotalCount(
  pathAndQuery: string,
  token: string | undefined,
): Promise<{ count: number; failed: boolean }> {
  try {
    const res = await fetch(`${GITHUB_API}${pathAndQuery}`, {
      headers: githubHeaders(token),
    });
    if (!res.ok) return { count: 0, failed: true };
    const json = (await res.json()) as { total_count?: unknown };
    if (typeof json.total_count !== 'number' && typeof json.total_count !== 'string') {
      return { count: 0, failed: true };
    }
    return { count: clampCount(json.total_count), failed: false };
  } catch {
    return { count: 0, failed: true };
  }
}

function deriveReposCreated(repos: RepoWithCreated[], windowStartIso: string): number {
  let n = 0;
  for (const r of repos) {
    if (r.fork) continue;
    const created = r.created_at ?? null;
    if (created !== null && created >= windowStartIso) n += 1;
  }
  return clampCount(n);
}

function deriveStarsNowTotal(repos: GitHubRepo[]): number {
  let sum = 0;
  for (const r of repos) {
    if (!r.fork) sum += r.stargazers_count;
  }
  return clampCount(sum);
}

function deriveTopRepos(repos: GitHubRepo[]): WrappedTopRepo[] {
  return [...repos]
    .filter((r) => !r.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 3)
    .map((r) => ({
      name: r.full_name,
      stars: clampCount(r.stargazers_count),
    }));
}

function deriveTopLanguages(repos: GitHubRepo[], windowStartIso: string): string[] {
  const counts = new Map<string, number>();
  for (const r of repos) {
    if (r.fork) continue;
    if (r.updated_at < windowStartIso) continue;
    if (!r.language) continue;
    counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, 5)
    .map(([lang]) => lang);
}

async function runAiVerdict(
  ai: NonNullable<WrappedEnv['AI']>,
  statsSummary: string,
): Promise<string | null> {
  try {
    const result = await ai.run(AI_MODEL, {
      messages: [
        {
          role: 'user',
          content: `Write one short witty English verdict (max 2 sentences) for this GitHub year-in-review. No markdown, no hashtags.\n${statsSummary}`,
        },
      ],
      max_tokens: 80,
    });
    const text =
      typeof result === 'string'
        ? result
        : typeof result?.response === 'string'
          ? result.response
          : null;
    if (text === null) return null;
    const trimmed = text.trim().slice(0, AI_VERDICT_MAX);
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
}

export async function buildWrappedReport(
  username: string,
  env: WrappedEnv,
): Promise<WrappedReport> {
  const cached = await getCachedReport(username);
  if (cached) return cached;

  const analysis = await fetchProfile(username);
  const login = analysis.user.login;
  const windowStartIso = new Date(Date.now() - WINDOW_DAYS * MS_PER_DAY).toISOString();
  const token = env.GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
  const dateOnly = windowStartIso.slice(0, 10);

  const [commitsR, prsOpenedR, prsMergedR, reviewsR, issuesR] = await Promise.all([
    searchTotalCount(
      `/search/commits?q=author:${login}+author-date:%3E=${dateOnly}&per_page=1`,
      token,
    ),
    searchTotalCount(
      `/search/issues?q=author:${login}+type:pr+created:%3E=${dateOnly}&per_page=1`,
      token,
    ),
    searchTotalCount(
      `/search/issues?q=author:${login}+type:pr+is:merged+created:%3E=${dateOnly}&per_page=1`,
      token,
    ),
    searchTotalCount(
      `/search/issues?q=reviewed-by:${login}+type:pr&per_page=1`,
      token,
    ),
    searchTotalCount(
      `/search/issues?q=author:${login}+type:issue+created:%3E=${dateOnly}&per_page=1`,
      token,
    ),
  ]);

  const repos = analysis.repos as RepoWithCreated[];
  const commits = clampCount(commitsR.count);
  const prsOpened = clampCount(prsOpenedR.count);
  const prsMerged = clampCount(prsMergedR.count);
  const reviewsGiven = clampCount(reviewsR.count);
  const issuesOpened = clampCount(issuesR.count);
  const reposCreated = deriveReposCreated(repos, windowStartIso);
  const starsNowTotal = deriveStarsNowTotal(analysis.repos);
  const topRepos = deriveTopRepos(analysis.repos);
  const topLanguages = deriveTopLanguages(analysis.repos, windowStartIso);
  const score = clampCount(analysis.score.total);
  const rank = getScoreRank(analysis.score.total).rank;
  const partial =
    commitsR.failed ||
    prsOpenedR.failed ||
    prsMergedR.failed ||
    reviewsR.failed ||
    issuesR.failed;

  let aiVerdict: string | null = null;
  if (env.AI) {
    const statsSummary = [
      `user=${login}`,
      `commits=${commits}`,
      `prsOpened=${prsOpened}`,
      `prsMerged=${prsMerged}`,
      `reviews=${reviewsGiven}`,
      `issues=${issuesOpened}`,
      `reposCreated=${reposCreated}`,
      `stars=${starsNowTotal}`,
      `score=${score}`,
      `rank=${rank}`,
      `langs=${topLanguages.join(',')}`,
    ].join(' ');
    aiVerdict = await runAiVerdict(env.AI, statsSummary);
  }

  const report: WrappedReport = {
    login,
    name: analysis.user.name,
    avatarUrl: analysis.user.avatar_url,
    windowStartIso,
    generatedAtMs: Date.now(),
    commits,
    prsOpened,
    prsMerged,
    reviewsGiven,
    issuesOpened,
    reposCreated,
    starsNowTotal,
    topRepos,
    topLanguages,
    score,
    rank,
    aiVerdict,
    partial,
  };

  await setCachedReport(username, report);
  return report;
}

/** Test helper: clear in-memory wrapped cache between tests. */
export function clearWrappedMemoryCache(): void {
  memoryCache.clear();
}
