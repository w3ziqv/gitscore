import type { LanguageStat } from '../types.js';

interface Props {
  languages: LanguageStat[];
}

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#ff5229',
  JavaScript: '#ff8204',
  Python: '#0082e6',
  Rust: '#e51300',
  Go: '#44ba82',
  Swift: '#ffaf01',
  HTML: '#e51300',
  CSS: '#151524',
  Java: '#ff5229',
  'C++': '#151524',
  C: '#6d6d78',
  'C#': '#44ba82',
  Ruby: '#e51300',
  PHP: '#0082e6',
  Shell: '#44ba82',
  Vue: '#44ba82',
  Dart: '#0082e6',
  Kotlin: '#ff8204',
  Scala: '#ff5229',
  Lua: '#0082e6',
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
