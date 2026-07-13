import type { VercelRequest, VercelResponse } from '@vercel/node';

const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  if (!URL || !TOKEN) {
    res.status(200).json({ error: 'env vars missing' });
    return;
  }

  const cmd = async (name: string, args: string[] = []): Promise<Record<string, unknown>> => {
    const path = `${URL}/${name}/${args.map(encodeURIComponent).join('/')}`;
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: '{}',
      });
      const body = (await r.text()).slice(0, 300);
      return { status: r.status, body };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'unknown' };
    }
  };

  const result: Record<string, unknown> = {
    ping: await cmd('ping'),
    setTest: await cmd('set', ['gitscore:test', '1']),
    getTest: await cmd('get', ['gitscore:test']),
    hsetTest: await cmd('hset', ['gitscore:meta', 'user1', 'value']),
    hgetall: await cmd('hgetall', ['gitscore:meta']),
    zaddTest: await cmd('zadd', ['gitscore:leaderboard', '1', 'w3ziqv']),
    zrangeTest: await cmd('zrange', ['gitscore:leaderboard', '0', '100', 'rev']),
    zcardTest: await cmd('zcard', ['gitscore:leaderboard']),
    aclWhoami: await cmd('acl', ['whoami']),
  };

  res.status(200).json(result);
}