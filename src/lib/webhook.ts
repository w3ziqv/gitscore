// src/lib/webhook.ts — threshold subscription helpers (pure where possible).
//
// Auth: the subscriber presents the shared secret from `WEBHOOK_SUB_TOKEN`
// (env). Comparison is timing-safe. When the env var is unset the endpoint
// returns 503 — webhooks are opt-in per deployment.
//
// SSRF guard: webhook URLs must be public https endpoints. Private ranges,
// loopback, link-local, CGNAT, and hostnames resolving to them are rejected.

import { createHash, timingSafeEqual } from 'node:crypto';
import { lookup } from 'node:dns/promises';

export function isBearerTokenValid(token: string | undefined): boolean {
  if (!token) return false;
  const expected = process.env.WEBHOOK_SUB_TOKEN;
  if (!expected) return false;
  const a = createHash('sha256').update(token).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function extractBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : undefined;
}

function isPrivateIpv4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => Number.isNaN(n))) return true;
  const [a, b] = p;
  if (a === 10) return true;            // RFC1918
  if (a === 127) return true;           // loopback
  if (a === 0) return true;             // "this network"
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isPrivateIp(ip: string): boolean {
  if (!ip.includes(':')) return isPrivateIpv4(ip);
  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;
  if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
  const v4mapped = /::ffff:(?:0:)?(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (v4mapped) return isPrivateIpv4(v4mapped[1] ?? '');
  return false;
}

/**
 * A webhook destination is safe only when it is https, carries no embedded
 * credentials, and every resolved address is public. The resolve-then-connect
 * gap (TOCTOU) is accepted for this feature; the alternative — pinning
 * connections — is out of scope here.
 */
export async function isSafeWebhookUrl(raw: string): Promise<boolean> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'https:') return false;
  if (u.username !== '' || u.password !== '') return false;
  const host = u.hostname.toLowerCase();
  if (host === '' || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return false;
  }
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every(({ address }) => !isPrivateIp(address));
  } catch {
    return false;
  }
}

/**
 * Build the JSON payload that we POST to a subscribed webhook_url when the
 * score crosses the threshold. Shared between save-time firing and the future
 * cron-driven re-check.
 */
export function buildThresholdPayload(input: {
  login: string;
  score: number;
  threshold: number;
  firedAtMs: number;
}): { login: string; score: number; threshold: number; firedAtMs: number; event: 'gitscore.threshold.cross'; } {
  return {
    login: input.login,
    score: input.score,
    threshold: input.threshold,
    firedAtMs: input.firedAtMs,
    event: 'gitscore.threshold.cross',
  };
}

/**
 * Fire the webhook with a 5s timeout + 1 retry on any non-2xx status.
 * Caller wraps in try/catch — failures are logged but never crash the API.
 */
export async function fireWebhook(url: string, payload: unknown): Promise<boolean> {
  const token = process.env.WEBHOOK_SUB_TOKEN ?? '';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'User-Agent': 'gitscore-webhook/1.0',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.status >= 200 && res.status < 300) return true;
      // fall through to retry on 5xx / non-2xx
      if (res.status >= 400 && res.status < 500) return false; // client error, don't retry
    } catch {
      // network failure or abort — retry once
    }
  }
  return false;
}
