// api/roast/[username].ts — GET /api/roast/:username?lang=pl
//
// Locale resolution:
//   1. ?lang= query param (e.g. `&lang=pl`)
//   2. Accept-Language header
//   3. 'en' fallback

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchProfile, sendError } from '../_lib/github.js';
import {
  generateRoastWithLang,
  parseAcceptLanguage,
} from '../../src/lib/roast.js';

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

  const langQ = typeof req.query?.lang === 'string' ? req.query.lang : '';
  const acceptLang = req.headers['accept-language'];
  const lang = langQ || parseAcceptLanguage(
    Array.isArray(acceptLang) ? acceptLang[0] : acceptLang,
  );

  try {
    const analysis = await fetchProfile(username);
    const roast = generateRoastWithLang(analysis.user, analysis.repos, analysis.score, lang);
    res.status(200).json({ ...roast, lang });
  } catch (error) {
    sendError(res, error);
  }
}