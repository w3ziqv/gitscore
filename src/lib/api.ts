// src/lib/api.ts — Defensive fetch helpers for the GitScore frontend.
//
// Why this exists: when the API layer isn't running (e.g. only `npm run dev`
// was started without `npm run dev:server` / `vercel dev`), the Vite /api/*
// proxy returns a non-2xx status with an EMPTY body — and calling
// `res.json()` on that throws the V8-internal message
// "Failed to execute 'json' on 'Response': Unexpected end of JSON input",
// which leaks to the user as the error banner and tells them nothing useful.
//
// These helpers parse defensively: read text first, try JSON, fall back to a
// human-readable status-based message. When the failure smells like a missing
// API server (status 0 / 5xx / network) they hint the actual fix.

export class ApiError extends Error {
  constructor(message: string, public status: number, public hint?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiOptions {
  /** Hint shown to the user when the call clearly unreachable (5xx / 0). */
  unreachableHint?: string;
}

/**
 * Fetch `url`, expect JSON, throw ApiError on non-2xx.
 * If `init.method === 'POST'`, treats `init.body` as JSON.
 */
export async function apiJson<T = unknown>(
  url: string,
  init?: RequestInit,
  opts: ApiOptions = {},
): Promise<T> {
  const res = await fetch(url, init);

  if (!res.ok) {
    throw await buildApiError(res, opts);
  }

  // Even on 2xx the body may be empty in some edge cases — guard it.
  const text = await res.text();
  if (!text) {
    throw new ApiError('Empty response from API', res.status);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError('API returned non-JSON body', res.status);
  }
}

/** Build an ApiError from a non-2xx Response, swallowing parse errors. */
async function buildApiError(res: Response, opts: ApiOptions): Promise<ApiError> {
  let text = '';
  try { text = await res.text(); } catch { /* body already consumed */ }

  let message = '';
  if (text) {
    try {
      const data = JSON.parse(text) as { error?: unknown };
      if (typeof data.error === 'string') message = data.error;
    } catch {
      message = text;
    }
  }

  if (!message) {
    message = `HTTP ${res.status}`;
  }

  const hint = looksUnreachable(res.status) ? opts.unreachableHint : undefined;
  return new ApiError(message, res.status, hint);
}

function looksUnreachable(status: number): boolean {
  return status === 0 || status === 502 || status === 503 || status === 504;
}

/** Compose user-facing message: text + optional hint. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiError) {
    return err.hint ? `${err.message}\n\n${err.hint}` : err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}