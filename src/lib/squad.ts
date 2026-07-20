// src/lib/squad.ts — F7 — pinned friends leaderboard (browser-only).
//
// Stored as `gitscore:squad` = stringified array of logins. The view-layer
// fetches /api/profile for each login in parallel to assemble a private
// "squad" leaderboard next to the global one.
//
// No auth — local trust model. Anyone with this browser can curate their own
// squad; it just won't survive a different device. Acceptable for a fun
// feature; admins can lift this to Neon later without changing the shape.

const KEY = 'gitscore:squad';
const MAX = 30;

export function readSquad(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function writeSquad(logins: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const cleaned = dedupe(
      logins
        .map(s => s.trim().replace(/^@+/, ''))
        .filter(Boolean),
    ).slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(cleaned));
  } catch {
    // localStorage may be unavailable (private mode, quota) — silent no-op
  }
}

export function addSquadMember(login: string): string[] {
  const normalized = login.trim().replace(/^@+/, '');
  if (!normalized) return readSquad();
  const next = dedupe([...readSquad(), normalized.toLowerCase()]);
  writeSquad(next);
  return next;
}

export function removeSquadMember(login: string): string[] {
  const next = readSquad().filter(s => s.toLowerCase() !== login.toLowerCase());
  writeSquad(next);
  return next;
}

export function isSquadMember(login: string): boolean {
  return readSquad().some(s => s.toLowerCase() === login.toLowerCase());
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr.map((v: T) => String(v)))).map(v => v as T);
}