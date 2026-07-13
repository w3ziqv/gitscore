// api/profile/[username].ts — GET /api/profile/:username

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchProfile, sendError } from '../_lib/github.js';

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
    res.status(200).json(analysis);
  } catch (error) {
    sendError(res, error);
  }
}
