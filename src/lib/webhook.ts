// src/lib/webhook.ts — F10 — threshold subscription helpers (pure where possible).
//
// `validateWebhookToken` enforces a 32+ char bearer token so subscribers must
// opt-in with their own `WEBHOOK_SUB_TOKEN` (or whatever they pick). The token
// comes from the `Authorization: Bearer ...` header and is stored alongside
// the subscription — never logged, never echoed back.

export function isBearerTokenValid(token: string | undefined): boolean {
  return Boolean(token) && (token ?? '').length >= 32 && /^[A-Za-z0-9_\-]+$/.test(token ?? '');
}

export function extractBearer(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : undefined;
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
export async function fireWebhook(url: string, payload: unknown, token: string): Promise<boolean> {
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