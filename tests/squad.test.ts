import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  readSquad,
  writeSquad,
  addSquadMember,
  removeSquadMember,
  isSquadMember,
} from '../src/lib/squad.js';

// squad.ts uses localStorage — vitest's jsdom-flavored DOM env ships an empty
// localStorage in the default node test env, so we mock with a real Map.

beforeEach(() => {
  const store = new Map<string, string>();
  const ls = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
  // squad.ts guards on `typeof window === 'undefined'` so we need a window-like
  // global on globalThis to pass that check, plus a localStorage entry that the
  // module's `localStorage.getItem` calls resolve through.
  // @ts-expect-error — partial mock for test environment
  globalThis.window = { localStorage: ls };
  // @ts-expect-error — partial mock; covers the localStorage global too
  globalThis.localStorage = ls;
});

describe('squad', () => {
  it('starts empty', () => {
    expect(readSquad()).toEqual([]);
  });

  it('addSquadMember inserts + dedupes (case-insensitive)', () => {
    addSquadMember('torvalds');
    addSquadMember('Torvalds');
    expect(readSquad()).toEqual(['torvalds']);
  });

  it('addSquadMember trims and strips leading @', () => {
    addSquadMember('  @gaearon  ');
    expect(readSquad()).toEqual(['gaearon']);
  });

  it('skip empty / whitespace-only inputs', () => {
    addSquadMember('  ');
    addSquadMember('');
    expect(readSquad()).toEqual([]);
  });

  it('caps at MAX entries (30)', () => {
    for (let i = 0; i < 40; i++) addSquadMember(`u${i}`);
    const s = readSquad();
    expect(s.length).toBeLessThanOrEqual(30);
  });

  it('removeSquadMember is idempotent', () => {
    addSquadMember('torvalds');
    removeSquadMember('torvalds');
    expect(readSquad()).toEqual([]);
    removeSquadMember('torvalds'); // no-op
    expect(readSquad()).toEqual([]);
  });

  it('isSquadMember is case-insensitive', () => {
    addSquadMember('torvalds');
    expect(isSquadMember('TORVALDS')).toBe(true);
    expect(isSquadMember('gaearon')).toBe(false);
  });

  it('writeSquad deduplicates on input', () => {
    writeSquad(['a', 'a', 'b', 'b']);
    expect(readSquad()).toEqual(['a', 'b']);
  });

  it('writeSquad trims each entry', () => {
    writeSquad(['  a  ', 'b']);
    expect(readSquad()).toEqual(['a', 'b']);
  });

  it('survives localStorage corruption (non-array)', () => {
    vi.spyOn(localStorage, 'getItem').mockReturnValueOnce('not-json');
    expect(readSquad()).toEqual([]);
  });

  it('survives localStorage corruption (array-ish garbage)', () => {
    vi.spyOn(localStorage, 'getItem').mockReturnValueOnce('[1,2,3]');
    expect(readSquad()).toEqual([]);
  });
});