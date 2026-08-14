# GitScore — Design System

Dark mission-control UI (SpaceX / x.ai inspired). One theme, no presets.
Every color, font size, and spacing value below is a token; components
reference tokens via `var()`, never hardcoded values.

## 1. Tokens

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#000000` | page background |
| `--surface` | `#0e0e0e` | panels, cards |
| `--surface-2` | `#161616` | nested panels, plates, cells |
| `--text` | `#f0f0fa` | primary text |
| `--muted` | `#9d9d9d` | secondary text |
| `--dim` | `#8f8f9b` | micro-labels, metadata (≥4.5:1 on black — WCAG AA) |
| `--border` | `rgb(255 255 255 / 0.1)` | hairline borders |
| `--border-strong` | `rgb(255 255 255 / 0.22)` | focus, emphasis borders |
| `--signal` | `#3fb950` | positive/status ONLY (winner, delta, live dot) |
| `--error` | `#e05d5d` | errors, negative deltas |
| `--ghost` / `--ghost-strong` / `--ghost-border` | text-color alpha overlays | hover fills, tracks |
| `--rank-s-plus` … `--rank-f` | #f85149 … #484f58 | rank stripes (S+/S/A/B/C/D/F) |

## 2. Typography

- Display: **Space Grotesk Variable** — headings, uppercase, `font-weight: 600`, tracking `-0.02em`
- Sans: **Inter Variable** — body copy
- Mono: **JetBrains Mono Variable** — data, numbers, micro-labels, glyphs, timestamps
- Self-hosted via `@fontsource-variable/*` — no external font requests
- Micro-label recipe: mono, `0.6875rem`, uppercase, `letter-spacing 0.14–0.22em`, `--dim`

## 3. Spacing / shape

- 4px grid; card padding `1.25–2rem`; gaps `0.5–1.5rem`
- **Zero border-radius everywhere**; borders `1px`; no shadows
- Panels: `--surface` + 1px `--border`; HUD corner brackets allowed on hero panels (`--border-strong`, 10px)

## 4. Primitives

- **Eyebrow**: mono uppercase label (`SCORE //`, `PROFILE //`, `ACTIVITY //`) — section heading pattern
- **Stat cell**: `--surface-2`, 1px `--border`, mono value + mono micro-label
- **Badge chip**: earned = `--ghost` + 1px border + geometric glyph (`○ ◇ ◈ ☆ ◐ ▸ ◉ ◆ ×` — never emoji); locked = `--dim`, `×` glyph
- **Track/bar**: 1px `--ghost` track, fill `--text` or `--signal`; width transitions only
- **Segmented control**: 1px group border; active = `--ghost` + inset 1px `--border-strong`
- **Link**: `--text`, hover `--muted`; target links may use `--signal` on hover

## 5. States & motion

- Hover: border `--border` → `--border-strong`, bg → `--ghost` — only on interactive elements
- Focus: `:focus-visible` outline 1px `--border-strong`, offset 2px
- Allowed animation (GPU-composited only): score count-up (900ms ease-out-cubic), bar `width` transition, pop scale on count-up end, blinking cursor on loading line
- `prefers-reduced-motion: reduce` disables all animation

## 6. Responsive

- Masthead right column (status/coords) hidden below 700px
- Two-column layouts (score hero, compare) collapse to 1 column ≤640–880px
- Leaderboard rows drop timestamps ≤640px; stats grid 5→3→2 columns

## 7. Accessibility constraints

- `--dim` on `--bg` must stay ≥ 4.5:1 (currently `#8f8f9b` ≈ 5.9:1)
- All icon glyphs `aria-hidden`; semantic headings preserved (`h1`–`h3`)
- View toggle uses `role="tablist"`/`role="tab"`; buttons are real `<button>`s
- Decorative pseudo-elements (`::before` brackets) are `pointer-events: none`

## 8. Accepted debt

- Skeleton loading uses CSS only (no animation library); shimmer intentionally omitted — static placeholder frames
- Sparkline readout is HTML overlay (SVG text distorts under `preserveAspectRatio="none"`) — see `ScoreDisplay.tsx`
- Canvas share card uses literal hex mirrors of tokens (canvas cannot read CSS vars) — keep in sync with §1 manually
