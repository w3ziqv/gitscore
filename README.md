# GitScore

GitHub profile analyzer with gamification — get a hotness score, badges, language breakdown, and a roast. Compare two developers head-to-head.

## Live Demo

[gitscore-mu.vercel.app](https://gitscore-mu.vercel.app)

![GitScore screenshot](screenshot.png)

## Features

- **Hotness Score (0–1000)** — weighted algorithm based on repos, stars, followers, activity, and language diversity
- **Score Rank** — F → D → C → B → A → S → S+ with color-coded display
- **Badges** — 9 achievement badges (Polyglot, Rising Star, Social Butterfly, Open Sourcerer, etc.)
- **Language Breakdown** — visual chart of programming languages across repos
- **Top Repositories** — top 5 repos by stars, with direct links
- **Roast Mode** — humorous, auto-generated critique of any profile
- **Head-to-Head** — compare two GitHub users side by side, with a winner badge
- **Score Breakdown** — see exactly how your score is calculated
- **Leaderboard** — cached scores in a SQLite database
- **API Caching** — GitHub API responses cached for 30 minutes to avoid rate limits
- **Dark theme** — GitHub-inspired UI

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite
- **Backend:** Node.js + Express
- **Database:** SQLite (Node.js built-in `node:sqlite`)
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
│   │   ├── App.tsx          # Main app, view switching
│   │   ├── SearchBar.tsx     # Username input
│   │   ├── ProfileCard.tsx   # Avatar, bio, stats
│   │   ├── ScoreDisplay.tsx  # Circular score + breakdown bars
│   │   ├── LanguageChart.tsx # Language distribution chart
│   │   ├── Badges.tsx        # Achievement badges grid
│   │   ├── RoastPanel.tsx    # Roast output
│   │   └── CompareMode.tsx   # Head-to-head comparison
│   ├── lib/
│   │   ├── score.ts          # Pure score calculation functions
│   │   └── roast.ts          # Pure roast message generator
│   ├── types.ts              # Shared TypeScript types
│   ├── main.tsx              # React entry point
│   ├── index.css             # Global styles
│   └── App.css               # App styles
├── server/
│   ├── index.ts              # Express API server
│   └── db.ts                 # SQLite cache + leaderboard
├── tests/
│   ├── score.test.ts         # 22 tests for score logic
│   └── roast.test.ts         # 9 tests for roast logic
├── .github/workflows/ci.yml  # CI: typecheck + test + build
├── index.html
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── package.json
```

## Run Locally

### Prerequisites

- Node.js 22+ (required for built-in `node:sqlite`)

### Install + dev mode

```bash
npm install

# Terminal 1: start backend
npm run dev:server

# Terminal 2: start frontend
npm run dev
```

Or run both at once:

```bash
npm run dev:all
```

The frontend runs at `http://localhost:5173` and proxies API calls to the backend at `http://localhost:3001`.

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
| GET | `/api/profile/:username` | Full profile analysis (score, badges, languages, repos) |
| GET | `/api/roast/:username` | Roast for a given user |
| GET | `/api/compare/:user1/:user2` | Side-by-side comparison of two users |
| GET | `/api/leaderboard` | Top 10 cached scores |
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

## Author

**Mateusz Szostak** — [w3ziqv](https://github.com/w3ziqv)

## License

MIT
