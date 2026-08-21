// types.ts — Shared TypeScript types for GitScore

export interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  followers: number;
  following: number;
  public_repos: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  fork: boolean;
  topics: string[];
}

export interface LanguageStat {
  language: string;
  bytes: number;
  percentage: number;
}

export interface Badge {
  id: string;
  name: string;
  glyph: string;
  description: string;
  earned: boolean;
}

export interface ScoreBreakdown {
  repos: number;
  stars: number;
  followers: number;
  activity: number;
  diversity: number;
  total: number;
}

export interface ProfileAnalysis {
  user: GitHubUser;
  repos: GitHubRepo[];
  languages: LanguageStat[];
  score: ScoreBreakdown;
  badges: Badge[];
  totalStars: number;
  totalForks: number;
  topRepos: GitHubRepo[];
}

export interface RoastResult {
  lines: string[];
  overall: string;
}

export type ScoreRank = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface LeaderboardEntry {
  login: string;
  name: string | null;
  avatar_url: string;
  score: number;
  rank: ScoreRank;
  badgesEarned: number;
  totalStars: number;
  followers: number;
  analyzedAtMs: number;
}

// F6: leaderboard entry plus score-delta over a window (e.g. +52 / -8 last 7d).
export interface ImprovedLeaderboardEntry extends LeaderboardEntry {
  delta: number;
}

export type RecentActivityType =
  | 'PushEvent'
  | 'PullRequestEvent'
  | 'IssuesEvent'
  | 'CreateEvent'
  | 'WatchEvent'
  | 'Other';

export interface RecentActivityItem {
  type: RecentActivityType;
  repo: string;
  url: string;
  createdAtIso: string;
  summary: string;
}

export interface RecentActivity {
  items: RecentActivityItem[];
  totalInRange: number;
}

export interface Recommendation {
  glyph: string;
  title: string;
  detail: string;
  impactPoints: number;
}

// GitScore Wrapped — rolling-365-day activity report for one user.
// All counters come from GitHub Search API total_count values; when a query
// fails the field falls back to 0 and `partial` is true (UI may soften copy).
export interface WrappedReport {
  login: string;
  name: string | null;
  avatarUrl: string;
  windowStartIso: string;
  generatedAtMs: number;
  commits: number;
  prsOpened: number;
  prsMerged: number;
  reviewsGiven: number;
  issuesOpened: number;
  reposCreated: number;
  starsNowTotal: number;
  topRepos: WrappedTopRepo[];
  topLanguages: string[];
  score: number;
  rank: ScoreRank;
  aiVerdict: string | null;
  partial: boolean;
}

export interface WrappedTopRepo {
  name: string;
  stars: number;
}