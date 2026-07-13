// Recommendations.tsx — Actionable tips to improve score

import { useMemo } from 'react';
import type { GitHubUser, GitHubRepo, ScoreBreakdown, Recommendation } from '../types.js';
import { generateRecommendations } from '../lib/recommendations.js';

interface Props {
  user: GitHubUser;
  repos: GitHubRepo[];
  score: ScoreBreakdown;
}

export default function Recommendations({ user, repos, score }: Props) {
  const recs: Recommendation[] = useMemo(
    () => generateRecommendations(user, repos, score, 3),
    [user, repos, score],
  );

  if (recs.length === 0) return null;

  return (
    <div className="recommendations">
      <h3 className="recommendations-header">
        <span className="tip-icon">💡</span> Tips to level up
      </h3>
      <div className="recommendations-grid">
        {recs.map((rec, i) => (
          <div key={i} className="rec-card">
            <span className="rec-emoji">{rec.emoji}</span>
            <div className="rec-body">
              <span className="rec-title">{rec.title}</span>
              <span className="rec-detail">{rec.detail}</span>
            </div>
            <span className="rec-impact">≈ +{rec.impactPoints} pts</span>
          </div>
        ))}
      </div>
    </div>
  );
}