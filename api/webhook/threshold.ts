// api/webhook/threshold.ts — F10 — POST /api/webhook/threshold
//
// Subscribe to a "score crossed threshold" event for a given login. The
// profile endpoint checks active subscriptions on each save (see
// api/profile/[username].ts) and fires the webhook once per subscription. The
// `fired_at_ms` column ensures we don't re-fire the same crossing until the
// next refresh window (cheap de-duplication).
//
// Auth: `Authorization: Bearer <token>` — must equal the `WEBHOOK_SUB_TOKEN`
// env secret (timing-safe comparison). When the env var is unset this route
// returns 503; webhooks are opt-in per deployment.
//
// SSRF guard: `webhook_url` must be a public https endpoint (private IPs,
// localhost, and hosts resolving to them are rejected).
//
// Body: { login: string, threshold: number(0..1000), webhook_url: string }

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ensureSchema, sql, isDbConfigured } from '../../src/lib/db.js';
import { extractBearer, isBearerTokenValid, isSafeWebhookUrl } from '../../src/lib/webhook.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isDbConfigured()) {
    res.status(503).json({ error: 'Database not configured. Set DATABASE_URL.' });
    return;
  }

  if (!process.env.WEBHOOK_SUB_TOKEN) {
    res.status(503).json({ error: 'Webhook subscriptions are disabled: WEBHOOK_SUB_TOKEN is not set.' });
    return;
  }

  const token = extractBearer(req.headers['authorization']);
  if (!isBearerTokenValid(token)) {
    res.status(401).json({ error: 'Missing or invalid Authorization Bearer (must match WEBHOOK_SUB_TOKEN).' });
    return;
  }

  const body = (req.body ?? {}) as { login?: unknown; threshold?: unknown; webhook_url?: unknown };

  const login = typeof body.login === 'string' ? body.login.trim().toLowerCase() : '';
  const threshold = typeof body.threshold === 'number' ? Math.floor(body.threshold) : undefined;
  const webhookUrl = typeof body.webhook_url === 'string' ? body.webhook_url.trim() : '';

  if (!/^[a-z0-9_\-]{1,39}$/i.test(login)) {
    res.status(400).json({ error: 'login must be a valid GitHub username' });
    return;
  }
  if (threshold === undefined || threshold < 0 || threshold > 1000) {
    res.status(400).json({ error: 'threshold must be an integer in 0..1000' });
    return;
  }
  if (!webhookUrl.startsWith('https://')) {
    res.status(400).json({ error: 'webhook_url must be an https URL' });
    return;
  }
  if (!(await isSafeWebhookUrl(webhookUrl))) {
    res.status(400).json({ error: 'webhook_url must point to a public https endpoint' });
    return;
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
    res.status(201).json({ id: rows[0]?.id, login, threshold, fired: false });
  } catch (err) {
    console.error('webhook subscribe failed:', err);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
}