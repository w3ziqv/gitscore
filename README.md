# GitScore

GitHub profile analyzer with gamification — get a hotness score, badges, language breakdown, recommendations, recent activity, and a roast. Compare two developers head-to-head.

## Live Demo

[gitscore-mu.vercel.app](https://gitscore-mu.vercel.app)

![GitScore screenshot](screenshot.png)

## Features

- **Hotness Score (0–1000)** — weighted algorithm based on repos, stars, followers, activity, and language diversity
- **Animated score count-up** — score number animates from 0 to total with ease-out cubic over 900ms
- **Score Rank** — F → D → C → B → A → S → S+ with color-coded display
- **Badges** — 9 achievement badges (Polyglot, Rising Star, Social Butterfly, Open Sourcerer, etc.)
- **Achievement Progress** — see how close you are to unlocking locked badges
- **Recommendations** — actionable tips to improve your score (e.g. "Earn your first star — +30 pts")
- **Language Breakdown** — visual chart of programming languages across repos
- **Top Repositories** — top 5 repos by stars, with direct links
- **Recent Activity** — last ~30 GitHub events (pushes, PRs, issues) pulled from GitHub Events API
- **Fun Stats** — account age, repos per year, follower ratio, dustiest repo, GitHub net worth
- **Roast Mode** — humorous, auto-generated critique of any profile
- **Head-to-Head** — compare two GitHub users side by side, with a winner badge
- **Share Card** — download a PNG with your score, breakdown, and badges to share on social media
- **Leaderboard** — global ranking on Neon Postgres (was: localStorage only). Every analyzed profile is upserted server-side and visible to everyone, with `localStorage` as a per-browser fallback.
- **Most-improved leaderboard tab** — second tab ranking profiles by score *delta* over the last 7 / 30 days using `score_history`. Rewards streaks and momentum, not just raw totals.
- **Squad leaderboard** — pin a small list of GitHub friends (localStorage) and see a private "squad" leaderboard next to the global one.
- **Dark mode + theme presets** — full theme toggle with localStorage persistence, respects `prefers-color-scheme`, no FOUC. Presets: `light` / `dark` / `synthwave` / `terminal-green` / `paper`.
- **Hard Mistral UI** — fully square corners, neobrutal hard-offset shadows, pixel-grid background (16px), blocky pixel-segment progress bars, square score block, pixel-G favicon, crisp-edge image rendering.
- **Embeddable SVG score badge** — `GET /api/badge/:username` returns a 220×44 SVG you can drop into any README.
- **Profile score timeline** — daily score snapshot per login (auto-migrating `score_history` table) + inline sparkline on the profile page showing the last 14 days.
- **Multi-language roast** — roast in Polish / Spanish / German / French / English, detected from `Accept-Language` (or `?lang=`)- **Roast of the Day** — homepage card surfacing the funniest roast among profiles analyzed in the last 24h.
- **Inbound webhook for score crosses** — `POST /api/webhook/threshold` to subscribe to "I finally hit rank A" events. The profile endpoint fires subscribers on each save.
- **`npx @gitscore/cli <username>`** — tiny companion CLI printing score / rank / a one-line roast with ANSI color. No deps, ESM, single file.
- **GitHub Action skeleton** — `action/action.yml` + `action/index.js` proof: posts the PR author's GitScore comment on their first PR.

## What's New

- **Hard Mistral UI overhaul** — every radius is 0; hard-offset shadows replace soft glows; score circle became a square score block; language dots + progress bars are pixel-segmented; web font kept (Inter + Space Mono) but all uppercase labels go through the mono face. New `favicon.svg` is a 16×16 pixel-G.
- **5 theme presets (F2)** — `light` / `dark` / `synthwave` / `terminal-green` / `paper`. `index.html` inline pre-React script accepts all five to keep no-FOUC.
- **Embeddable SVG badge (F1)** — `![GitScore](https://gitscore-mu.vercel.app/api/badge/w3ziqv)` works out of the box. The frontend has an "Embed badge" button that copies the markdown.
- **Score timeline (F5)** — `score_history` table auto-creates on first request; profile endpoint writes one row per UTC day per login. `GET /api/score-history/:username?days=14` returns `{ history: number[] }`; the profile card renders an inline sparkline when history ≥ 2 points.
- **Most-improved leaderboard (F6)** — `GET /api/leaderboard?tab=improved&window=7` ranks by score-delta derived from `score_history`. New "Most improved" tab in the UI with a 7d / 30d toggle.
- **Squad leaderboard (F7)** — pin GitHub friends in localStorage and see them ranked alongside the global board.
- **Multi-language roast (F3)** — roast in EN/PL/ES/DE/FR. `parseAcceptLanguage` + `?lang=` param.
- **Roast of the Day (F4)** — `GET /api/roast-of-the-day` picks the funniest roast from the last 24h (falls back to deterministic rotation of the global leaderboard if no recent roasts).
- **Webhook subscriptions (F10)** — `POST /api/webhook/threshold` with `Authorization: Bearer <≥32-char token>` registers a subscriber; the profile endpoint fires it on each save when the score crosses the threshold (24h de-dupe via `fired_at_ms`).
- **`npx @gitscore/cli` (F8)** — companion CLI in `packages/cli`. `node packages/cli/bin/gitscore.js torvalds`.
- **GitHub Action skeleton (F9)** — `action/action.yml` + `action/index.js`. Bundle with `npx @vercel/ncc build` before publishing.
- **Global leaderboard is live** 🎉 — migrated from Upstash Redis to **Neon Postgres** so anyone visiting the site is ranked globally, not just in their own browser. Schema auto-creates on first request; only `DATABASE_URL` is needed (Vercel Storage → Neon marketplace does it in two clicks).
- **Serverless-friendly DB driver** — `@neondatabase/serverless` HTTP driver plays well with Vercel functions; pooled connection string used by default.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Vercel serverless functions (Node.js runtime)
- **Database:** Neon Postgres (leaderboard persistence, serverless HTTP driver) + localStorage fallback
- **External APIs:** GitHub REST API (users, repos, events)
- **Testing:** Vitest (69 unit tests across score, roast, multi-language roast, badge SVG, squad, score-history helpers)
- **CI:** GitHub Actions (typecheck + test + build)

## Score Algorithm

The hotness score (0–1000) is calculated as:

| Component | Max Points | Formula |
|---|---|---|
| Repos | 200 | `min(public_repos * 5, 200)` |
| Stars | 300 | `min(total_stars * 3, 300)` |
| Followers | 200 | `min(followers * 4, 200)` |
| Activity | 150 | `min(recent_repos * 15, 150)` (repos updated in last 90 days) |
| Diversity | 150 | `min(languages * 20, 150)` |

Ranks: F (<100) → D (100+) → C (200+) → B (350+) → A (500+) → S (650+) → S+ (800+)

## Project Structure

```text
gitscore/
├── src/
│   ├── components/
│   │   ├── App.tsx                # Main app, view switching (single/compare/leaderboard), theme toggle
│   │   ├── SearchBar.tsx          # Username input
│   │   ├── ProfileCard.tsx        # Avatar, bio, stats
│   │   ├── ScoreDisplay.tsx       # Animated score circle + breakdown bars + timestamp
│   │   ├── LanguageChart.tsx      # Language distribution chart
│   │   ├── Badges.tsx             # Achievement badges grid
│   │   ├── AchievementProgress.tsx
│   │   ├── Recommendations.tsx     # Tips to improve score
│   │   ├── FunStats.tsx           # Trivia stats (account age, ratios, net worth)
│   │   ├── RecentActivity.tsx     # Last ~30 GitHub events (pushes/PRs/issues)
│   │   ├── RoastPanel.tsx         # Roast output
│   │   ├── ShareCard.tsx          # Canvas-based PNG download, theme-aware
│   │   ├── CompareMode.tsx        # Head-to-head comparison
│   │   └── LeaderboardView.tsx    # Top profiles ranking (server + localStorage)
│   ├── lib/
│   │   ├── score.ts               # Pure score calculation functions
│   │   ├── roast.ts               # Pure roast message generator
│   │   ├── funStats.ts            # Fun stats calculator
│   │   ├── recommendations.ts    # Recommendation generator based on score headroom
│   │   ├── activity.ts            # GitHub Events parser (pure)
│   │   ├── db.ts                  # Neon Postgres SQL client + idempotent schema init
│   │   ├── leaderboard.ts         # Neon Postgres leaderboard wrapper (upsert + select)
│   │   └── localLeaderboard.ts     # localStorage fallback + merge function
│   ├── types.ts                   # Shared TypeScript types
│   ├── main.tsx                   # React entry point
│   ├── index.css                  # Global styles + light/dark theme variables
│   └── App.css                    # All component styles
├── api/
│   ├── profile/[username].ts      # GET /api/profile/:username → ProfileAnalysis
│   ├── roast/[username].ts        # GET /api/roast/:username → RoastResult
│   ├── compare/[user1]/[user2].ts # GET /api/compare/:u1/:u2 → side-by-side
│   ├── activity/[username].ts     # GET /api/activity/:username → RecentActivity
│   ├── leaderboard.ts             # GET /api/leaderboard?limit=N → LeaderboardEntry[]
│   ├── health.ts                  # GET /api/health
│   └── _lib/github.ts             # Shared GitHub API client + error handling
├── tests/
│   ├── score.test.ts              # Tests covering score logic
│   └── roast.test.ts              # Tests covering roast logic
├── .github/workflows/ci.yml       # CI: typecheck + test + build
├── index.html                     # Inline pre-React theme script (no FOUC)
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── package.json
```

## Run Locally

### Prerequisites

- Node.js 22+

### Install + dev mode

```bash
npm install
npm run dev
```

The frontend runs at `http://localhost:5173`. API calls in dev hit the Vercel serverless functions defined in `/api` — to test those locally, use `vercel dev`.

### Optional: enable global leaderboard

The leaderboard persists to a Neon Postgres database. Create one (free tier is enough):

1. Sign up at **[neon.tech](https://neon.tech)** and create a new project.
2. Pick a region close to where your Vercel functions run (e.g. `AWS US-EAST-1` for Vercel's default `iad1`).
3. Copy the **pooled connection string** from the Neon dashboard — it looks like
   `postgres://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`.
4. Put it in `.env` locally (see `.env.example`):

   ```
   DATABASE_URL=postgres://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```

5. In Vercel: **Project → Settings → Environment Variables →** add the same `DATABASE_URL`, then redeploy.

The schema is created automatically on the first request — no migration step needed. Without `DATABASE_URL`, the leaderboard falls back to localStorage (per-browser) automatically.

### Production build

```bash
npm run build
npm run preview
```

### Tests

```bash
npm test
```

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/profile/:username` | Full profile analysis (score, badges, languages, repos) — also persists to leaderboard + score_history + fires threshold webhooks if Neon configured |
| GET | `/api/roast/:username?lang=pl` | Roast for a given user (EN/PL/ES/DE/FR via `?lang=` or `Accept-Language`) |
| GET | `/api/compare/:user1/:user2` | Side-by-side comparison of two users |
| GET | `/api/activity/:username` | Recent activity (last ~30 GitHub events: pushes, PRs, issues) |
| GET | `/api/badge/:username?theme=dark` | Embeddable 220×44 SVG score badge (rank + score + login, Hard Mistral pixel) for README embeds |
| GET | `/api/score-history/:username?days=14` | Score sparkline points (oldest→newest) — `{ history: number[] }` |
| GET | `/api/roast-of-the-day` | Today's funniest roast among recently analyzed profiles |
| GET | `/api/leaderboard?limit=N&tab=improved&window=7` | Top N profiles by score (default `tab=global`) or by score-delta (`tab=improved&window=7\|30`) |
| POST | `/api/webhook/threshold` | Subscribe to score-cross events: body `{ login, threshold, webhook_url }` + `Authorization: Bearer <≥32-char token>` |
| GET | `/api/health` | Health check |

## Badges

| Badge | Emoji | Requirement |
|---|---|---|
| Newcomer | 🌱 | Account < 1 year old |
| Veteran | 🏆 | Account > 3 years old |
| Polyglot | 🌐 | 5+ distinct languages |
| Rising Star | ⭐ | 10+ total stars |
| Social Butterfly | 🦋 | 50+ followers |
| Consistent | 🔥 | Pushed in last 7 days |
| Open Sourcerer | 🧙 | 20+ public repos |
| Zero to Hero | 💎 | Score ≥ 500 |
| Need a Push | 🫠 | Score < 100 |

## Roadmap

### Global leaderboard

- **Status:** ✅ **live** — Neon Postgres (`@neondatabase/serverless` in `src/lib/leaderboard.ts` + `src/lib/db.ts`).
- **To enable in your own deploy:** follow the **Optional: enable global leaderboard** steps above — set `DATABASE_URL` in `.env` (local) and in Vercel environment variables, then redeploy. The schema is created on first request.
- **Tuning:** add `ORDER BY score DESC, analyzed_at_ms DESC` tie-break and a `analyzedAtMs`-based decay so the leaderboard favors recently active profiles. Add a per-region leaderboard tab.

### Shipped (was Planned)

All previously-planned features from the README are now implemented:

- ✅ **Embeddable SVG score badge** — `GET /api/badge/:username`
- ✅ **Profile score timeline** — `score_history` table + sparkline component + `GET /api/score-history/:username`
- ✅ **Most-improved leaderboard** — `GET /api/leaderboard?tab=improved&window=7|30` + UI tab
- ✅ **`npx @gitscore/cli <username>` CLI** — `packages/cli/bin/gitscore.js`
- ✅ **GitHub Action** — `action/action.yml` + `action/index.js` (proof — bundle with `ncc` before publishing)
- ✅ **Pinned friends leaderboard** — `src/lib/squad.ts` + UI "Squad" tab
- ✅ **Roast of the Day** — `GET /api/roast-of-the-day` + homepage card
- ✅ **Theme presets** — synthwave / terminal-green / paper via ThemePicker dropdown
- ✅ **Multi-language roast** — EN/PL/ES/DE/FR via `?lang=` or `Accept-Language`
- ✅ **Inbound webhook for score crosses** — `POST /api/webhook/threshold` with bearer token auth

### Still planned

- Per-region leaderboard tab (DB sharding by region header)
- Action bundled + published as `w3ziqv/gitscore-action@v1` on the GitHub marketplace
- More roast locales (jp / zh / it / pt / ru)
- Vercel Cron re-check of threshold subs (currently fires only on profile saves)

## Author

**Mateusz Szostak** — [w3ziqv](https://github.com/w3ziqv)

## License

MIT