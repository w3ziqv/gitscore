import { describe, it, expect } from 'vitest';
import { generateWrappedCardSvg } from '../src/lib/wrappedCard.js';
import type { WrappedReport } from '../src/types.js';

function makeReport(overrides: Partial<WrappedReport> = {}): WrappedReport {
  return {
    login: 'torvalds',
    name: 'Linus Torvalds',
    avatarUrl: 'https://example.com/avatar.png',
    windowStartIso: '2025-08-21T00:00:00.000Z',
    generatedAtMs: 1_752_000_000_000,
    commits: 12345,
    prsOpened: 234,
    prsMerged: 180,
    reviewsGiven: 90,
    issuesOpened: 45,
    reposCreated: 12,
    starsNowTotal: 67890,
    topRepos: [],
    topLanguages: [],
    score: 987,
    rank: 'S+',
    aiVerdict: 'A relentless force of nature.',
    partial: false,
    ...overrides,
  };
}

describe('generateWrappedCardSvg', () => {
  it('produces well-formed XML SVG with hardcoded dimensions', () => {
    const svg = generateWrappedCardSvg(makeReport());
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('width="1200"');
    expect(svg).toContain('height="630"');
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('is deterministic — identical input yields byte-identical output', () => {
    const a = generateWrappedCardSvg(makeReport());
    const b = generateWrappedCardSvg(makeReport());
    expect(a).toBe(b);
  });

  it('escapes XML special characters in login, name, and aiVerdict', () => {
    const svg = generateWrappedCardSvg(
      makeReport({
        login: '<script>alert(1)</script>',
        name: '<img src=x onerror=alert(1)>',
        aiVerdict: '"><script>x</script>',
      }),
    );
    expect(svg).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(svg).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(svg).toContain('&quot;&gt;&lt;script&gt;x&lt;/script&gt;');
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('<img');
  });

  it('formats stat numbers with en-US thousands separators', () => {
    const svg = generateWrappedCardSvg(makeReport());
    expect(svg).toContain('>12,345<');
    expect(svg).toContain('>234<');
    expect(svg).toContain('>67,890<');
  });

  it('uses the rank color for the rank letter', () => {
    const sPlus = generateWrappedCardSvg(makeReport({ rank: 'S+' }));
    expect(sPlus).toContain('#f85149');
    const f = generateWrappedCardSvg(makeReport({ rank: 'F' }));
    expect(f).toContain('#484f58');
  });

  it('contains the footer domain string', () => {
    const svg = generateWrappedCardSvg(makeReport());
    expect(svg).toContain('gitscore.mateusz-szostak1.workers.dev');
  });

  it('omits the aiVerdict quote element when aiVerdict is null', () => {
    const svg = generateWrappedCardSvg(makeReport({ aiVerdict: null }));
    expect(svg).not.toContain('“');
    const withVerdict = generateWrappedCardSvg(makeReport());
    expect(withVerdict).toContain('“A relentless force of nature.”');
  });

  it('ellipsizes a long aiVerdict to ~90 chars', () => {
    const long = 'a'.repeat(200);
    const svg = generateWrappedCardSvg(makeReport({ aiVerdict: long }));
    expect(svg).toContain(`“${'a'.repeat(89)}…”`);
    expect(svg).not.toContain('a'.repeat(90));
  });

  it('prefixes @login when name is shown, and omits it when name is null', () => {
    const withName = generateWrappedCardSvg(makeReport());
    expect(withName).toContain('Linus Torvalds @torvalds');
    const noName = generateWrappedCardSvg(makeReport({ name: null }));
    expect(noName).toContain('>torvalds<');
    expect(noName).not.toContain('@torvalds');
  });
});