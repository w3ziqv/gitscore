// api/score-history/[username].ts — GET /api/score-history/:username?days=14
//
// Returns `{ history: number[] }` (oldest→newest) for the sparkline on the
// profile page. Returns an empty array when the DB is not configured or the
// login has no recorded snapshots yet.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getLastNDays } from '../../src/lib/scoreHistory.js';

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
  const daysParam = typeof req.query?.days === 'string' ? req.query.days : '14';
  const days = Math.min(Math.max(parseInt(daysParam ?? '14', 10) || 14, 1), 90);

  try {
    const history = await getLastNDays(username, days);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).json({ history });
  } catch (err) {
    console.error('score-history error:', err);
    res.status(200).json({ history: [] });
  }
}