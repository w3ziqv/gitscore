import type { VercelRequest, VercelResponse } from '@vercel/node';

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const result: Record<string, unknown> = {
    hasUrl: Boolean(URL),
    hasToken: Boolean(TOKEN),
    urlPrefix: URL ? URL.slice(0, 20) + '...' : null,
  };

  if (!URL || !TOKEN) {
    res.status(200).json({ ...result, error: 'env vars missing', ping: null, testWrite: null });
    return;
  }

  try {
    const pingRes = await fetch(`${URL}/ping`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    result.pingStatus = pingRes.status;
    result.pingBody = (await pingRes.text()).slice(0, 100);
  } catch (err) {
    result.pingError = err instanceof Error ? err.message : 'unknown';
  }

  try {
    const testRes = await fetch(`${URL}/set/gitscore:test/1`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    result.testWriteStatus = testRes.status;
    result.testWriteBody = (await testRes.text()).slice(0, 100);
  } catch (err) {
    result.testWriteError = err instanceof Error ? err.message : 'unknown';
  }

  res.status(200).json(result);
}