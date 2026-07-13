import type { VercelRequest, VercelResponse } from '@vercel/node';
import { parseGitHubEvents } from '../../src/lib/activity.js';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const EVENTS_LIMIT = 30;

interface RawGitHubEvent {
  id: string;
  type: string;
  repo: { name: string };
  created_at: string;
  payload?: Record<string, unknown>;
  actor?: { login: string };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const username = Array.isArray(req.query?.username) ? req.query.username[0] : req.query?.username;
  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'Username is required' });
    return;
  }

  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'gitscore',
    };
    if (GITHUB_TOKEN) {
      headers.Authorization = `Bearer ${GITHUB_TOKEN}`;
    }

    const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events?per_page=${EVENTS_LIMIT}`, {
      headers,
    });

    if (response.status === 404) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch activity from GitHub' });
      return;
    }

    const events = (await response.json()) as RawGitHubEvent[];
    const parsed = parseGitHubEvents(events, 8);
    res.status(200).json(parsed);
  } catch (err) {
    console.error('activity error:', err);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
}