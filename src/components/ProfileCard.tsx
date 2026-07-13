import type { ProfileAnalysis } from '../types.js';

interface Props {
  analysis: ProfileAnalysis;
}

export default function ProfileCard({ analysis }: Props) {
  const { user, totalStars, totalForks } = analysis;

  return (
    <div className="profile-card">
      <img src={user.avatar_url} alt={user.login} className="avatar" />
      <div className="profile-info">
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
          {user.location && <span>📍 {user.location}</span>}
          {user.company && <span>🏢 {user.company}</span>}
        </div>
        <div className="profile-stats">
          <div className="stat">
            <span className="stat-value">{user.public_repos}</span>
            <span className="stat-label">Repos</span>
          </div>
          <div className="stat">
            <span className="stat-value">{user.followers}</span>
            <span className="stat-label">Followers</span>
          </div>
          <div className="stat">
            <span className="stat-value">{user.following}</span>
            <span className="stat-label">Following</span>
          </div>
          <div className="stat">
            <span className="stat-value">{totalStars}</span>
            <span className="stat-label">Stars</span>
          </div>
          <div className="stat">
            <span className="stat-value">{totalForks}</span>
            <span className="stat-label">Forks</span>
          </div>
        </div>
      </div>
    </div>
  );
}
