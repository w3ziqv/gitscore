import type { ProfileAnalysis } from '../types.js';
import './ProfileCard.css';

interface Props {
  analysis: ProfileAnalysis;
}

export default function ProfileCard({ analysis }: Props) {
  const { user, totalStars, totalForks } = analysis;

  return (
    <div className="profile-card">
      <img src={user.avatar_url} alt={user.login} className="avatar" width={88} height={88} loading="lazy" decoding="async" />
      <div className="profile-info">
        <span className="profile-eyebrow">PROFILE //</span>
        <h2 className="profile-name">{user.name || user.login}</h2>
        <a
          href={`https://github.com/${user.login}`}
          target="_blank"
          rel="noopener noreferrer"
          className="profile-login"
        >
          @{user.login}
        </a>
        {user.bio && <p className="profile-bio">{user.bio}</p>}
        <div className="profile-meta">
          {user.location && (
            <span className="profile-meta-item">
              <span className="profile-meta-label">Location</span>
              <span className="profile-meta-value">{user.location}</span>
            </span>
          )}
          {user.company && (
            <span className="profile-meta-item">
              <span className="profile-meta-label">Company</span>
              <span className="profile-meta-value">{user.company}</span>
            </span>
          )}
        </div>
        <div className="profile-stats">
          <div className="stat">
            <span className="stat-label">Repos</span>
            <span className="stat-value">{user.public_repos}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Followers</span>
            <span className="stat-value">{user.followers}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Following</span>
            <span className="stat-value">{user.following}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Stars</span>
            <span className="stat-value">{totalStars}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Forks</span>
            <span className="stat-value">{totalForks}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
