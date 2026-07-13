// api/roast/[username].ts — GET /api/roast/:username

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchProfile, sendError } from '../_lib/github.js';
import { generateRoast } from '../../src/lib/roast.js';

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
    const roast = generateRoast(analysis.user, analysis.repos, analysis.score);
    res.status(200).json(roast);
  } catch (error) {
    sendError(res, error);
  }
}
