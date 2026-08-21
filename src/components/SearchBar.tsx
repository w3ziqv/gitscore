import { useState, type FormEvent } from 'react';

const USERNAME_RE = /^[a-z0-9_-]{1,39}$/i;
const USERNAME_ERROR = 'USERNAME: 1-39 CHARS, A-Z 0-9 _ -';

interface Props {
  onSearch: (username: string) => void;
  loading: boolean;
  initialValue?: string | null;
}

export default function SearchBar({ onSearch, loading, initialValue }: Props) {
  const [value, setValue] = useState(initialValue ?? '');

  const trimmed = value.trim();
  const invalid = trimmed.length > 0 && !USERNAME_RE.test(trimmed);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!trimmed || invalid) return;
    onSearch(trimmed);
  };

  return (
    <form className="search-form" onSubmit={handleSubmit}>
      <div className="search-field">
        <div className="search-wrapper">
          <span className="search-prefix">@</span>
          <input
            type="text"
            className="search-input"
            placeholder="Enter GitHub username..."
            value={value}
            onChange={e => setValue(e.target.value)}
            disabled={loading}
            aria-label="GitHub username"
            aria-invalid={invalid || undefined}
          />
        </div>
        {invalid && (
          <p className="username-error" role="alert">
            {USERNAME_ERROR}
          </p>
        )}
      </div>
      <button
        type="submit"
        className="search-btn"
        disabled={loading || !trimmed || invalid}
      >
        {loading ? 'ANALYZING' : 'ANALYZE'}
      </button>
    </form>
  );
}
