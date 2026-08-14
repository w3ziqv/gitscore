// src/lib/github.ts — Shared GitHub API client + cache (Workers Cache API + Map fallback)

import {
  calculateScore,
  extractLanguages,
  calculateBadges,
  getTopRepos,
  calculateTotalStars,
  calculateTotalForks,
} from './score.js';
import type { GitHubUser, GitHubRepo, ProfileAnalysis } from '../types.js';

const GITHUB_API = 'https://api.github.com';
const CACHE_TTL_MS = 1000 * 60 * 30;
const CACHE_TTL_SECONDS = 60 * 30;
const USERNAME_RE = /^[a-z0-9_-]{1,39}$/i;
const CACHE_ORIGIN = 'https://github-cache.gitscore.internal';

interface CacheEntry {
  data: string;
  timestamp: number;
}

/** Fallback when caches.default is unavailable (e.g. Node/vitest). */
const memoryCache = new Map<string, CacheEntry>();

function cacheKeyUrl(username: string): string {
  return `${CACHE_ORIGIN}/profile/${encodeURIComponent(username.toLowerCase())}`;
}

function getMemoryCached(username: string): ProfileAnalysis | null {
  const key = username.toLowerCase();
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return JSON.parse(entry.data) as ProfileAnalysis;
}

function setMemoryCached(username: string, data: ProfileAnalysis): void {
  memoryCache.set(username.toLowerCase(), {
    data: JSON.stringify(data),
    timestamp: Date.now(),
  });
}

async function getCachedAnalysis(username: string): Promise<ProfileAnalysis | null> {
  try {
    const cacheStorage = (globalThis as { caches?: { default?: Cache } }).caches?.default;
    if (cacheStorage) {
      const req = new Request(cacheKeyUrl(username));
      const hit = await cacheStorage.match(req);
      if (hit) {
        const text = await hit.text();
        return JSON.parse(text) as ProfileAnalysis;
      }
      return null;
    }
  } catch {
    // fall through to memory
  }
  return getMemoryCached(username);
}

async function setCachedAnalysis(username: string, data: ProfileAnalysis): Promise<void> {
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

/** Exported for tests / callers that still want sync memory peek. */
export function getCachedAnalysisSync(username: string): ProfileAnalysis | null {
  return getMemoryCached(username);
}

export function setCachedAnalysisSync(username: string, data: ProfileAnalysis): void {
  setMemoryCached(username, data);
}

async function fetchGitHub(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'GitScore/1.0',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return fetch(`${GITHUB_API}${path}`, { headers });
}

export async function fetchProfile(username: string): Promise<ProfileAnalysis> {
  if (!USERNAME_RE.test(username)) throw new Error('INVALID_USERNAME');

  const cached = await getCachedAnalysis(username);
  if (cached) return cached;

  const userResponse = await fetchGitHub(`/users/${username}`);
  if (!userResponse.ok) {
    if (userResponse.status === 404) throw new Error('USER_NOT_FOUND');
    if (userResponse.status === 403) throw new Error('RATE_LIMITED');
    throw new Error(`GITHUB_ERROR_${userResponse.status}`);
  }
  const user = (await userResponse.json()) as GitHubUser;

  const reposResponse = await fetchGitHub(`/users/${username}/repos?per_page=100&sort=updated`);
  if (!reposResponse.ok) {
    throw new Error(`REPOS_ERROR_${reposResponse.status}`);
  }
  const repos = (await reposResponse.json()) as GitHubRepo[];

  const languages = extractLanguages(repos);
  const score = calculateScore(user, repos, languages);
  const badges = calculateBadges(user, repos, score);
  const topRepos = getTopRepos(repos, 5);
  const totalStars = calculateTotalStars(repos);
  const totalForks = calculateTotalForks(repos);

  const analysis: ProfileAnalysis = {
    user,
    repos,
    languages,
    score,
    badges,
    topRepos,
    totalStars,
    totalForks,
  };

  await setCachedAnalysis(username, analysis);
  return analysis;
}

export function errorStatusAndBody(error: unknown): { status: number; body: { error: string } } {
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  if (message === 'USER_NOT_FOUND') {
    return { status: 404, body: { error: 'User not found' } };
  }
  if (message === 'RATE_LIMITED') {
    return { status: 429, body: { error: 'GitHub API rate limit exceeded. Try again later.' } };
  }
  if (message === 'INVALID_USERNAME') {
    return { status: 400, body: { error: 'Invalid username' } };
  }
  return { status: 500, body: { error: message } };
}
