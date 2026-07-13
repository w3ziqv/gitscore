// server/index.ts — Express API server for GitScore

import express from 'express';
import cors from 'cors';
import { getCached, setCached, upsertLeaderboard, getLeaderboard } from './db.js';
import {
  calculateScore,
  extractLanguages,
  calculateBadges,
  getTopRepos,
  calculateTotalStars,
  calculateTotalForks,
} from '../src/lib/score.js';
import { generateRoast } from '../src/lib/roast.js';
import type { GitHubUser, GitHubRepo, ProfileAnalysis } from '../src/types.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const GITHUB_API = 'https://api.github.com';

async function fetchGitHub(path: string): Promise<Response> {
  return fetch(`${GITHUB_API}${path}`, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'GitScore/1.0',
    },
  });
}

async function fetchProfile(username: string): Promise<ProfileAnalysis> {
  const cached = getCached(username);
  if (cached) {
    return JSON.parse(cached.data) as ProfileAnalysis;
  }

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

  setCached(username, JSON.stringify(analysis));
  upsertLeaderboard(username, score.total);

  return analysis;
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/profile/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const analysis = await fetchProfile(username);
    res.json(analysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    if (message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
    } else if (message === 'RATE_LIMITED') {
      res.status(429).json({ error: 'GitHub API rate limit exceeded. Try again later.' });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

app.get('/api/roast/:username', async (req, res) => {
  try {
    const username = req.params.username;
    const analysis = await fetchProfile(username);
    const roast = generateRoast(analysis.user, analysis.repos, analysis.score);
    res.json(roast);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    if (message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'User not found' });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

app.get('/api/compare/:user1/:user2', async (req, res) => {
  try {
    const { user1, user2 } = req.params;
    const [analysis1, analysis2] = await Promise.all([fetchProfile(user1), fetchProfile(user2)]);
    res.json({ user1: analysis1, user2: analysis2 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    if (message === 'USER_NOT_FOUND') {
      res.status(404).json({ error: 'One or both users not found' });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

app.get('/api/leaderboard', (_req, res) => {
  const entries = getLeaderboard(10);
  res.json(entries);
});

app.listen(PORT, () => {
  console.log(`GitScore API running at http://localhost:${PORT}`);
});
