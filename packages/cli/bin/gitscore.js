// bin/gitscore.js — `npx @gitscore/cli <username>` / `node bin/gitscore.js <username>`.
//
// Hits the public GitScore `/api/profile` and `/api/roast` endpoints (default
// origin: gitscore-mu.vercel.app, overridable via GITSORE_API env) and prints
// a compact, ANSI-colored summary:
//
//   $ gitscore torvalds
//   ┌─ torvalds ──────────────────────────┐
//   │ Rank: S+   Score: 1000   Repos: 250 │
//   └─────────────────────────────────────┘
//   » Okay, we get it. You're a 10x developer. Now go touch grass.
//
// No deps — pure Node, ESM, single file. Works offline if --api is unreachable
// (prints a friendly error). Joyful, not impressive.

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  fgOrange: '\x1b[38;5;208m',
  fgRed: '\x1b[38;5;196m',
  fgGreen: '\x1b[38;5;46m',
  fgBlue: '\x1b[38;5;33m',
  fgYellow: '\x1b[33m',
  bgBg: '\x1b[48;5;235m',
};

const DEFAULT_ORIGIN = 'https://gitscore-mu.vercel.app';

function getEnv(key, fallback) {
  const v = process.env[key];
  return v && v.length > 0 ? v : fallback;
}

async function fetchJson(origin, path) {
  const url = `${origin.replace(/\/$/, '')}${path}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      'User-Agent': 'gitscore-cli/0.1',
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    const err = new Error(body.error || `HTTP ${res.status}`);
    err.code = res.status;
    throw err;
  }
  return res.json();
}

function rankColor(rank) {
  switch (rank) {
    case 'S+': return ANSI.fgRed;
    case 'S': return ANSI.fgOrange;
    case 'A': return ANSI.fgYellow;
    case 'B': return ANSI.fgGreen;
    case 'C': return ANSI.fgBlue;
    default: return ANSI.dim;
  }
}

function box(content) {
  const top = `┌${'─'.repeat(content.length + 2)}┐`;
  const mid = `│ ${content} │`;
  const bot = `└${'─'.repeat(content.length + 2)}┘`;
  return [top, mid, bot].join('\n');
}

function printProfile(profile, origin) {
  const login = profile.user.login;
  const name = profile.user.name || login;
  const score = profile.score.total;
  const rank = profile.score.rank || 'F';
  const repos = profile.user.public_repos;
  const stars = profile.totalStars;
  const followers = profile.user.followers;
  const languages = profile.languages.length;

  const rankStr = `${rankColor(rank)}${ANSI.bold}Rank ${rank}${ANSI.reset}`;
  const scoreStr = `${ANSI.bold}${score}${ANSI.reset}/1000`;
  const header = `${ANSI.bold}${name}${ANSI.reset} ${ANSI.dim}(@${login})${ANSI.reset}`;
  const row = `${rankStr}  ${scoreStr}  ${ANSI.dim}·${ANSI.reset}  ${repos} repos  ${stars}★  ${followers} followers  ${languages} langs`;
  console.log(box(`${header}`));
  console.log(row);
  console.log(`${ANSI.dim}source: ${origin}${ANSI.reset}`);
}

async function printRoast(origin, login) {
  try {
    const roast = await fetchJson(
      origin,
      `/api/roast/${encodeURIComponent(login)}?lang=en`,
    );
    const firstLine = roast.lines && roast.lines[0];
    if (firstLine) {
      console.log(`${ANSI.fgOrange}» ${firstLine}${ANSI.reset}`);
    }
    if (roast.overall) {
      console.log(`${ANSI.dim}overall: ${roast.overall}${ANSI.reset}`);
    }
  } catch (err) {
    console.log(`${ANSI.dim}roast skipped: ${err.message}${ANSI.reset}`);
  }
}

function usage() {
  console.log(`gitscore <username> [options]

Arguments:
  username            GitHub login to analyze (required)

Options:
  --api=<url>         GitScore API origin (default: ${DEFAULT_ORIGIN})
                      or set GITSORE_API env var
  --help, -h          Show this help
  --version, -v       Print CLI version

Examples:
  gitscore torvalds
  gitscore gaearon --api=http://localhost:5173
`);
}

function parseArgs(argv) {
  const args = { username: '', api: '', help: false, version: false };
  for (const a of argv) {
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--version' || a === '-v') args.version = true;
    else if (a.startsWith('--api=')) args.api = a.slice(6);
    else if (!a.startsWith('--') && !args.username) args.username = a;
  }
  return args;
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) { usage(); return 0; }
  if (args.version) { console.log('0.1.0'); return 0; }
  if (!args.username) {
    usage();
    return 1;
  }

  const origin = args.api || getEnv('GITSORE_API', DEFAULT_ORIGIN);
  try {
    const profile = await fetchJson(
      origin,
      `/api/profile/${encodeURIComponent(args.username)}`,
    );
    printProfile(profile, origin);
    console.log('');
    await printRoast(origin, args.username);
    return 0;
  } catch (err) {
    if (err.code === 404) {
      console.error(`${ANSI.fgRed}✘ GitHub user "${args.username}" not found.${ANSI.reset}`);
    } else {
      console.error(`${ANSI.fgRed}✘ ${err.message || 'unknown error'}${ANSI.reset}`);
    }
    return 1;
  }
}

// When invoked as `node bin/gitscore.js ...` this runs the entry.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).then(code => {
    process.exitCode = code;
  });
}

export { main, parseArgs, fetchJson, box, rankColor };