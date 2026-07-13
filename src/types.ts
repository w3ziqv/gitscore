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
  emoji: string;
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
