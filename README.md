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
- **Leaderboard** — top profiles saved locally (global leaderboard is a roadmap goal below)
- **Dark mode** — full theme toggle with localStorage persistence, respects `prefers-color-scheme`, no FOUC
- **Mistral-style UI** — square corners, cream background, orange accent, mono numbers, subtle dot-grid pattern

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Vercel serverless functions (Node.js runtime)
- **Database:** Neon Postgres (leaderboard persistence, serverless HTTP driver) + localStorage fallback
- **External APIs:** GitHub REST API (users, repos, events)
- **Testing:** Vitest (31 unit tests)
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
| GET | `/api/profile/:username` | Full profile analysis (score, badges, languages, repos) — also persists to leaderboard if Neon configured |
| GET | `/api/roast/:username` | Roast for a given user |
| GET | `/api/compare/:user1/:user2` | Side-by-side comparison of two users |
| GET | `/api/activity/:username` | Recent activity (last ~30 GitHub events: pushes, PRs, issues) |
| GET | `/api/leaderboard?limit=N` | Top N profiles by score (Neon Postgres if configured, otherwise empty) |
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

- **Status:** backend ready (`@neondatabase/serverless` integration in `src/lib/leaderboard.ts` and `src/lib/db.ts`).
- **Current behavior:** when `DATABASE_URL` is set, every profile analyzed is upserted into the `leaderboard` Postgres table and the leaderboard tab shows server entries merged with `localStorage`. Without `DATABASE_URL`, it falls back to localStorage-only.
- **To enable:** follow the **Optional: enable global leaderboard** steps above — set `DATABASE_URL` in `.env` (local) and in Vercel environment variables, then redeploy. The schema is created on first request.
- **Future:** add write of `analyzedAtMs`-based decay so the leaderboard favors recently active profiles, and a per-region leaderboard tab.

## Author

**Mateusz Szostak** — [w3ziqv](https://github.com/w3ziqv)

## License

MIT