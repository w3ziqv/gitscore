# GitScore

GitHub profile analyzer. Type a username, get a score from 0 to 1000, badges,
a language breakdown, and a roast. You can also compare two users head to head
or check the global leaderboard.

Live: [gitscore.mateusz-szostak1.workers.dev](https://gitscore.mateusz-szostak1.workers.dev)

## Features

- **Score (0–1000)** — five factors: repos, stars, followers, activity, language diversity. Weights and caps below.
- **Ranks** — F → D → C → B → A → S → S+, color-coded.
- **Badges** — 9 achievements (Polyglot, Rising Star, Social Butterfly, Open Sourcerer, ...) with progress bars for the locked ones.
- **Recommendations** — concrete tips with point impact, based on what's missing from your score.
- **Language breakdown** — what your repos are written in, as a stacked bar.
- **Recent activity** — last ~30 GitHub events.
- **Roast mode** — auto-generated critique of a profile, in EN/PL/ES/DE/FR. "Roast of the day" on the homepage.
- **Head-to-head** — two users side by side, winner highlighted.
- **Wrapped** — full-screen story of your last 365 days on GitHub: commits shipped,
  PRs vs reviews identity, stars, language DNA and a rank reveal, ending in a
  downloadable share card. Powered by the GitHub Search API, cached 30 min;
  an optional one-line AI verdict (Cloudflare Workers AI) with a deterministic fallback.
- **Share card** — download a PNG with score, breakdown and badges.
- **Leaderboard** — global ranking persisted in Neon Postgres, with a localStorage fallback. Two extra tabs: *Most improved* (score delta over 7/30 days) and *Squad* (your pinned friends).
- **Embeddable badge** — `![GitScore](https://gitscore.mateusz-szostak1.workers.dev/api/badge/w3ziqv)` for READMEs.

## Score algorithm

Five pillars, 0–1000 total. Forks never count anywhere. Every raw signal
saturates, so whales can't dominate and small honest profiles still move.

| Pillar | Field | Max | How it's calculated |
|---|---|---|---|
| Impact | `stars` | 300 | Original stars: `300·ln(1+s)/ln(751)` — 10★ ≈ 109 pts, ~750 fills the cap |
| Consistency | `activity` | 250 | Recency per original repo (<7d=25, <14d=18, <30d=12, <90d=7, <180d=4, <365d=2, cap 175) **plus** monthly cadence: distinct active months in the last year ×6.25 (cap 75) |
| Portfolio | `repos` | 180 | Non-fork repos: sqrt base `160·√n/√40` + up to 20 pts craft bonus for described repos |
| Community | `followers` | 170 | `170·ln(1+f)/ln(1001)` — ~1000 fills the cap; ×0.6 dampening for follow-ring patterns (`following > 200` and `> 5× followers`) |
| Range | `diversity` | 100 | Effective languages = exp(Shannon entropy) over original repos' languages — token one-off repos barely count; 6 balanced languages fill the cap |

Design rules baked into the model: sustained behavior beats burstable counts
(cadence spans 12 months, so it can't be farmed in a weekend), follow-for-follow
rings are dampened rather than erased, and diversity uses perplexity so a dozen
exotic single-repo experiments score below six genuinely used languages.
Ranks: F <100, D 100+, C 200+, B 350+, A 500+, S 650+, S+ 800+.

## Tech stack

- Frontend: React 19 + TypeScript + Vite
- Backend: Cloudflare Workers (Hono) — one worker serves both the API and the static assets
- Database: Neon Postgres (leaderboard, score history) with localStorage fallback
- Data: GitHub REST API (+ Search API for Wrapped)
- AI (optional): Cloudflare Workers AI binding (`AI`) for the one-line Wrapped verdict; absent or failing => deterministic fallback
- Tests: Vitest — 100 unit tests (score, roast, localization, badge SVG, squad, score history, webhooks, wrapped report + card)

## Run locally

```bash
npm install
npm run dev      # Vite dev — the Worker serves /api in-workerd, no extra server
```

Tests and build:

```bash
npm test
npm run build    # outputs dist/client (assets) + worker bundle
```

## Deploy (Cloudflare Workers)

```bash
npm run build
npx wrangler deploy --config wrangler.deploy.jsonc
```

The repo also ships `.github/workflows/deploy.yml` (wrangler-action on push to
main; needs `CLOUDFLARE_API_TOKEN` in repo secrets). Cron `0 3 * * *` refreshes
the top of the leaderboard when `GITHUB_TOKEN` is set.

### Secrets

Set these on the worker (dashboard → gitscore → Settings → Variables, or
`npx wrangler secret put <NAME>`):

| Secret | Why |
|---|---|
| `GITHUB_TOKEN` | **Required in practice.** Without it the GitHub API anonymous limit (60/h per IP) is shared across all Cloudflare egress IPs and exhausts in minutes — profiles return 429. With it: 5000/h. |
| `DATABASE_URL` | Neon Postgres for the global leaderboard + score history + threshold webhooks. Without it those features gracefully no-op (localStorage fallback). |
| `WEBHOOK_SUB_TOKEN` | Enables `POST /api/webhook/threshold` (score-cross alerts). Without it the route returns 503. |

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/profile/:username` | Full analysis: score, badges, languages, repos |
| GET | `/api/roast/:username?lang=pl` | Roast (en/pl/es/de/fr, from `?lang` or `Accept-Language`) |
| GET | `/api/compare/:user1/:user2` | Side-by-side comparison |
| GET | `/api/activity/:username` | Recent GitHub events |
| GET | `/api/badge/:username` | 220×44 SVG score badge for README embeds |
| GET | `/api/score-history/:username?days=14` | Score timeline for the sparkline |
| GET | `/api/roast-of-the-day` | Today's roast from recently analyzed profiles |
| GET | `/api/leaderboard?tab=global\|improved&window=7\|30` | Global ranking or score-delta ranking |
| GET | `/api/wrapped/:username` | Rolling-365-day Wrapped report (commits, PRs, reviews, stars, languages) |
| GET | `/api/wrapped-card/:username` | 1200×630 SVG share card for the Wrapped report |
| GET | `/api/health` | Health check |

## Sharing & promotion

Wrapped is built to travel: every story ends in a downloadable PNG card and a
copyable `?wrapped=<login>` link. The SVG card endpoint embeds anywhere:

```md
![GitScore Wrapped](https://gitscore.mateusz-szostak1.workers.dev/api/wrapped-card/w3ziqv)
```

## Badges

| Badge | Requirement |
|---|---|
| Newcomer | Account younger than 1 year |
| Veteran | Account older than 3 years |
| Polyglot | 5+ distinct languages |
| Rising Star | 10+ total stars |
| Social Butterfly | 50+ followers |
| Consistent | Pushed code in the last 7 days |
| Open Sourcerer | 20+ public repos |
| Zero to Hero | Score ≥ 500 |
| Need a Push | Score < 100 |

## Notes

- The UI is a dark mission-control look (SpaceX/x.ai inspired): black
  background, mono data readouts, hairline borders. No themes, one look.
- Badge glyphs in the UI are geometric characters (○ ◇ ☆ ▸), not emojis.
- Threshold webhooks (score-cross alerts) are opt-in: set `WEBHOOK_SUB_TOKEN`
  (a long random string) to enable `POST /api/webhook/threshold`.
- `screenshot.png` is regenerated from the homepage when the design changes.

## Author

Mateusz Szostak — [w3ziqv](https://github.com/w3ziqv)

## License

MIT
