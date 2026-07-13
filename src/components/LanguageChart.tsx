import type { LanguageStat } from '../types.js';

interface Props {
  languages: LanguageStat[];
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Swift: '#F05138',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Shell: '#89e051',
  Vue: '#41b883',
  Dart: '#00B4AB',
  Kotlin: '#A97BFF',
  Scala: '#c22d40',
  Lua: '#000080',
};

function langColor(language: string): string {
  return LANG_COLORS[language] || '#8b949e';
}

export default function LanguageChart({ languages }: Props) {
  if (languages.length === 0) {
    return (
      <div className="language-chart">
        <h3>Languages</h3>
        <p className="no-data">No language data available.</p>
      </div>
    );
  }

  const top = languages.slice(0, 8);

  return (
    <div className="language-chart">
      <h3>Languages</h3>
      <div className="lang-bar-container">
        {top.map(lang => (
          <div
            key={lang.language}
            className="lang-bar-segment"
            style={{
              width: `${lang.percentage}%`,
              backgroundColor: langColor(lang.language),
            }}
            title={`${lang.language}: ${lang.percentage}%`}
          />
        ))}
      </div>
      <div className="lang-list">
        {top.map(lang => (
          <div key={lang.language} className="lang-item">
            <span className="lang-dot" style={{ backgroundColor: langColor(lang.language) }} />
            <span className="lang-name">{lang.language}</span>
            <span className="lang-pct">{lang.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
