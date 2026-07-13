import { useState, type FormEvent } from 'react';

interface Props {
  onSearch: (username: string) => void;
  loading: boolean;
}

export default function SearchBar({ onSearch, loading }: Props) {
  const [value, setValue] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSearch(trimmed);
  };

  return (
    <form className="search-form" onSubmit={handleSubmit}>
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
        />
      </div>
      <button type="submit" className="search-btn" disabled={loading || !value.trim()}>
        {loading ? 'Analyzing...' : 'Analyze'}
      </button>
    </form>
  );
}
