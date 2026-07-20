import { describe, it, expect } from 'vitest';
import { generateRoastWithLang, parseAcceptLanguage } from '../src/lib/roast.js';
import type { GitHubUser, GitHubRepo, ScoreBreakdown } from '../src/types.js';

function makeUser(overrides: Partial<GitHubUser> = {}): GitHubUser {
  return {
    login: 'testuser',
    name: 'Test User',
    avatar_url: 'https://example.com/avatar.png',
    bio: 'A developer',
    company: 'ACME',
    location: 'Earth',
    blog: 'https://example.com',
    followers: 10,
    following: 5,
    public_repos: 5,
    created_at: '2020-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    id: 1,
    name: 'test-repo',
    full_name: 'testuser/test-repo',
    html_url: 'https://github.com/testuser/test-repo',
    description: 'A test repo',
    language: 'TypeScript',
    stargazers_count: 5,
    forks_count: 1,
    updated_at: '2024-01-01T00:00:00Z',
    fork: false,
    topics: [],
    ...overrides,
  };
}

function makeScore(overrides: Partial<ScoreBreakdown> = {}): ScoreBreakdown {
  return {
    repos: 25,
    stars: 15,
    followers: 40,
    activity: 30,
    diversity: 20,
    total: 130,
    ...overrides,
  };
}

describe('generateRoastWithLang', () => {
  it('returns English when lang is "en"', () => {
    const r = generateRoastWithLang(makeUser({ public_repos: 0 }), [], makeScore({ total: 0 }), 'en');
    expect(r.lines.some(l => l.includes('gave up'))).toBe(true);
  });

  it('returns Polish lines for lang="pl"', () => {
    const r = generateRoastWithLang(makeUser({ public_repos: 0 }), [], makeScore({ total: 0 }), 'pl');
    expect(r.lines.some(l => l.includes('odpuściłeś'))).toBe(true);
  });

  it('returns Spanish lines for lang="es"', () => {
    const r = generateRoastWithLang(makeUser({ public_repos: 0 }), [], makeScore({ total: 0 }), 'es');
    expect(r.lines.some(l => l.includes('rendiste'))).toBe(true);
  });

  it('returns German lines for lang="de"', () => {
    const r = generateRoastWithLang(makeUser({ public_repos: 0 }), [], makeScore({ total: 0 }), 'de');
    expect(r.lines.some(l => l.includes('aufgegeben'))).toBe(true);
  });

  it('returns French lines for lang="fr"', () => {
    const r = generateRoastWithLang(makeUser({ public_repos: 0 }), [], makeScore({ total: 0 }), 'fr');
    expect(r.lines.some(l => l.includes('abandonné'))).toBe(true);
  });

  it('degrades to English when lang is unknown', () => {
    const r = generateRoastWithLang(makeUser({ public_repos: 0 }), [], makeScore({ total: 0 }), 'xx');
    expect(r.lines.some(l => l.includes('gave up'))).toBe(true);
  });

  it('degrades to English when lang is empty', () => {
    const r = generateRoastWithLang(makeUser({ public_repos: 0 }), [], makeScore({ total: 0 }), '');
    expect(r.lines.some(l => l.includes('gave up'))).toBe(true);
  });

  it('uses Polish overall verdict for low score', () => {
    const r = generateRoastWithLang(makeUser(), [makeRepo()], makeScore({ total: 50 }), 'pl');
    expect(r.overall).toContain('początkujący');
  });

  it('uses Spanish overall verdict for high score', () => {
    const r = generateRoastWithLang(makeUser(), [makeRepo()], makeScore({ total: 850 }), 'es');
    expect(r.overall).toContain('leyenda');
  });

  it('always returns at least one line per locale', () => {
    for (const lang of ['en', 'pl', 'es', 'de', 'fr']) {
      const r = generateRoastWithLang(makeUser(), [makeRepo()], makeScore({ total: 300 }), lang);
      expect(r.lines.length).toBeGreaterThan(0);
    }
  });

  it('handles region tags (e.g. "pl-PL")', () => {
    const r = generateRoastWithLang(makeUser({ public_repos: 0 }), [], makeScore({ total: 0 }), 'pl-PL');
    expect(r.lines.some(l => l.includes('odpuściłeś'))).toBe(true);
  });
});

describe('parseAcceptLanguage', () => {
  it('returns "en" for empty header', () => {
    expect(parseAcceptLanguage(undefined)).toBe('en');
    expect(parseAcceptLanguage('')).toBe('en');
  });

  it('returns "en" when no supported locale present', () => {
    expect(parseAcceptLanguage('ja,zh-CN;q=0.9')).toBe('en');
  });

  it('picks the highest-priority supported match (first wins)', () => {
    expect(parseAcceptLanguage('fr;q=0.9, en;q=0.8')).toBe('fr');
  });

  it('handles region tags', () => {
    expect(parseAcceptLanguage('en-GB,en-US;q=0.9')).toBe('en');
    expect(parseAcceptLanguage('es-ES,es-MX;q=0.8')).toBe('es');
    expect(parseAcceptLanguage('pt-BR,pl;q=0.5')).toBe('pl');
  });

  it('is case-insensitive', () => {
    expect(parseAcceptLanguage('PL')).toBe('pl');
    expect(parseAcceptLanguage('De-de')).toBe('de');
  });
});