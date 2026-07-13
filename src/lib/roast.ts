// roast.ts — Roast message generator (pure functions, fully testable)

import type { GitHubUser, GitHubRepo, ScoreBreakdown, RoastResult } from '../types.js';
import { calculateTotalStars } from './score.js';

export function generateRoast(user: GitHubUser, repos: GitHubRepo[], score: ScoreBreakdown): RoastResult {
  const lines: string[] = [];
  const totalStars = calculateTotalStars(repos);
  const nonForkedRepos = repos.filter(r => !r.fork);
  const ownRepos = nonForkedRepos.length;

  if (user.public_repos === 0) {
    lines.push('You signed up, saw the empty profile, and just... gave up?');
  }

  if (user.public_repos > 0 && ownRepos === 0) {
    lines.push('Every single repo is a fork. You\'re not a developer — you\'re a librarian.');
  }

  if (totalStars === 0 && user.public_repos > 0) {
    lines.push('Your code is so secret, even GitHub can\'t star it. Or maybe it\'s just... not good.');
  }

  if (totalStars < 5 && user.public_repos > 10) {
    lines.push(`${user.public_repos} repos and ${totalStars} stars. That\'s a star-to-repo ratio that would make a startup cry.`);
  }

  if (user.followers === 0) {
    lines.push('Zero followers. You\'re coding in a void. At least your rubber duck is impressed.');
  }

  if (user.followers > 0 && user.followers > user.public_repos * 5) {
    lines.push(`${user.followers} followers but only ${user.public_repos} repos? You\'re the influencer of GitHub — all follow, no code.`);
  }

  if (user.public_repos > 30 && totalStars < 10) {
    lines.push('Quantity over quality? You\'re the fast food chain of repositories.');
  }

  if (user.bio === null) {
    lines.push('No bio. Are you a developer or a mystery? Even your profile is undefined.');
  }

  if (user.company === null && user.blog === null) {
    lines.push('No company, no blog. You\'re a ghost with a GitHub account.');
  }

  const accountAgeDays = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
  if (accountAgeDays > 365 && user.public_repos < 5) {
    lines.push(`Your account is ${Math.floor(accountAgeDays / 365)} years old with ${user.public_repos} repos. That's a repo per year. Living on the edge.`);
  }

  if (score.total < 100) {
    lines.push('Your GitHub is like a gym membership — signed up, never went.');
  }

  if (score.total >= 800) {
    lines.push('Okay, we get it. You\'re a 10x developer. Now go touch grass.');
  }

  if (score.diversity < 20 && user.public_repos > 5) {
    lines.push('One language? Really? Even Google Translate supports more.');
  }

  if (score.activity < 30) {
    lines.push('Your last commit was so long ago, it\'s practically an archaeological artifact.');
  }

  let overall: string;
  if (score.total < 100) {
    overall = 'Ouch. But hey, every expert was once a beginner. Start pushing code!';
  } else if (score.total < 300) {
    overall = 'You\'re getting there. A few more repos and some stars wouldn\'t kill you.';
  } else if (score.total < 600) {
    overall = 'Solid profile. You clearly know what you\'re doing. Mostly.';
  } else if (score.total < 800) {
    overall = 'Impressive! You\'re a proper developer. Don\'t let it go to your head.';
  } else {
    overall = 'You\'re a GitHub legend. Or you bought followers. One of the two.';
  }

  if (lines.length === 0) {
    lines.push('Honestly? Your profile is... fine. Suspiciously fine. Nobody\'s this balanced.');
  }

  return { lines, overall };
}
