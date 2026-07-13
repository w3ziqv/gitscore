import type { RecentActivity, RecentActivityItem, RecentActivityType } from '../types.js';

interface RawGitHubEvent {
  id: string;
  type: string;
  repo: { name: string };
  created_at: string;
  payload?: {
    action?: string;
    pull_request?: { html_url: string; number: number; title?: string };
    issue?: { html_url: string; number: number; title?: string };
    ref?: string;
    ref_type?: string;
    commits?: Array<{ message: string; sha: string }>;
  };
  actor?: { login: string };
}

const TYPE_MAP: Record<string, RecentActivityType> = {
  PushEvent: 'PushEvent',
  PullRequestEvent: 'PullRequestEvent',
  IssuesEvent: 'IssuesEvent',
  CreateEvent: 'CreateEvent',
  WatchEvent: 'WatchEvent',
};

export function parseGitHubEvents(raw: RawGitHubEvent[], limit: number = 8): RecentActivity {
  const items: RecentActivityItem[] = [];
  let pushCount = 0;

  for (const event of raw) {
    const type = TYPE_MAP[event.type] ?? 'Other';
    const repo = event.repo?.name ?? 'unknown';
    const summary = buildSummary(event);
    if (!summary) continue;

    const url = buildUrl(event, repo);

    items.push({
      type,
      repo,
      url,
      createdAtIso: event.created_at,
      summary,
    });

    if (type === 'PushEvent') pushCount++;

    if (items.length >= limit) break;
  }

  return { items, totalInRange: pushCount };
}

function buildSummary(event: RawGitHubEvent): string | null {
  const action = event.payload?.action;
  const repoShort = event.repo?.name?.split('/')?.[1] ?? event.repo?.name ?? 'repo';

  switch (event.type) {
    case 'PushEvent': {
      const commits = event.payload?.commits?.length ?? 0;
      return commits === 1
        ? `Pushed 1 commit to ${repoShort}`
        : `Pushed ${commits} commits to ${repoShort}`;
    }
    case 'PullRequestEvent': {
      const pr = event.payload?.pull_request;
      if (!pr) return null;
      return `${cap(action)} PR #${pr.number}${pr.title ? `: ${pr.title}` : ''}`;
    }
    case 'IssuesEvent': {
      const issue = event.payload?.issue;
      if (!issue) return null;
      return `${cap(action)} issue #${issue.number}${issue.title ? `: ${issue.title}` : ''}`;
    }
    case 'CreateEvent': {
      const refType = event.payload?.ref_type ?? 'repository';
      const refName = event.payload?.ref;
      return refName
        ? `Created ${refType} ${refName} in ${repoShort}`
        : `Created ${refType} ${repoShort}`;
    }
    case 'WatchEvent':
      return `Starred ${repoShort}`;
    default:
      return null;
  }
}

function buildUrl(event: RawGitHubEvent, repo: string): string {
  switch (event.type) {
    case 'PullRequestEvent':
      return event.payload?.pull_request?.html_url ?? `https://github.com/${repo}`;
    case 'IssuesEvent':
      return event.payload?.issue?.html_url ?? `https://github.com/${repo}`;
    default:
      return `https://github.com/${repo}`;
  }
}

function cap(s: string | undefined): string {
  if (!s) return 'Updated';
  return s.charAt(0).toUpperCase() + s.slice(1);
}