import { describe, it, expect } from 'vitest';
import { generateBadgeSvg } from '../src/lib/badge.js';

describe('generateBadgeSvg', () => {
  it('produces well-formed XML SVG with hardcoded dimensions', () => {
    const svg = generateBadgeSvg({ login: 'torvalds', score: 1000, rank: 'S+' });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('width="220"');
    expect(svg).toContain('height="44"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('uses the rank color for the left stripe', () => {
    const svg = generateBadgeSvg({ login: 'x', score: 50, rank: 'F' });
    // F rank maps to #484f58
    expect(svg).toContain('#484f58');
  });

  it('escapes XML special characters in login', () => {
    const svg = generateBadgeSvg({ login: '<script>&"', score: 100, rank: 'D' });
    expect(svg).toContain('&lt;script&gt;&amp;&quot;');
    expect(svg).not.toContain('<script>');
  });

  it('embeds the numeric score verbatim', () => {
    const svg = generateBadgeSvg({ login: 'u', score: 732, rank: 'S' });
    expect(svg).toContain('>732<');
  });

  it('renders a dark background when theme=dark', () => {
    const dark = generateBadgeSvg({ login: 'u', score: 1, rank: 'F', theme: 'dark' });
    expect(dark).toContain('#0c0c14');
    const light = generateBadgeSvg({ login: 'u', score: 1, rank: 'F', theme: 'light' });
    expect(light).toContain('#fbfbf8');
  });

  it('falls back to light theme for unknown theme strings', () => {
    // @ts-expect-error — purposely invalid theme input to confirm the default applies
    const svg = generateBadgeSvg({ login: 'u', score: 1, rank: 'F', theme: 'synthwave' });
    expect(svg).toContain('#fbfbf8');
  });
});