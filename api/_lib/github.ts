// api/_lib/github.ts — Shared GitHub API client + in-memory cache for Vercel serverless

import {
  calculateScore,
  extractLanguages,
  calculateBadges,
  getTopRepos,
  calculateTotalStars,
  calculateTotalForks,
} from '../../src/lib/score.js';
import type { GitHubUser, GitHubRepo, ProfileAnalysis } from '../../src/types.js';

const GITHUB_API = 'https://api.github.com';
const CACHE_TTL_MS = 1000 * 60 * 30;

interface CacheEntry {
  data: string;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();

export function getCachedAnalysis(username: string): ProfileAnalysis | null {
  const entry = cache.get(username);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(username);
    return null;
  }
  return JSON.parse(entry.data) as ProfileAnalysis;
}

export function setCachedAnalysis(username: string, data: ProfileAnalysis): void {
  cache.set(username, { data: JSON.stringify(data), timestamp: Date.now() });
}

async function fetchGitHub(path: string): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'GitScore/1.0',
    },
  });
}

export async function fetchProfile(username: string): Promise<ProfileAnalysis> {
  const cached = getCachedAnalysis(username);
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

  setCachedAnalysis(username, analysis);
  return analysis;
}

export function sendError(res: import('@vercel/node').VercelResponse, error: unknown): void {
  const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
  if (message === 'USER_NOT_FOUND') {
    res.status(404).json({ error: 'User not found' });
  } else if (message === 'RATE_LIMITED') {
    res.status(429).json({ error: 'GitHub API rate limit exceeded. Try again later.' });
  } else {
    res.status(500).json({ error: message });
  }
}
