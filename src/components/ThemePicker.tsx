// ThemePicker.tsx — light/dark + presets dropdown (F2)
//
// Hard-edged pixel menu; clicking the button toggles the menu; selecting a
// theme fires onThemeChange(theme). The list of themes lives here so App can
// pass a stable reference.

import { useEffect, useRef, useState } from 'react';

export type ThemeName = 'light' | 'dark' | 'synthwave' | 'terminal-green' | 'paper';

interface ThemeDef {
  name: ThemeName;
  label: string;
  /** tiny color preview swatch (background + border) */
  swatch: string;
}

export const THEMES: ThemeDef[] = [
  { name: 'light', label: 'Light / Cream', swatch: '#fbfbf8' },
  { name: 'dark', label: 'Dark', swatch: '#0c0c14' },
  { name: 'synthwave', label: 'Synthwave', swatch: '#1b0a3a' },
  { name: 'terminal-green', label: 'Terminal Green', swatch: '#02110a' },
  { name: 'paper', label: 'Paper', swatch: '#ede5d2' },
];

interface Props {
  theme: ThemeName;
  onThemeChange: (theme: ThemeName) => void;
}

export default function ThemePicker({ theme, onThemeChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="theme-controls" ref={rootRef}>
      <button
        type="button"
        className="theme-toggle"
        aria-label="Toggle theme picker"
        aria-expanded={open}
        title="Theme"
        onClick={() => setOpen(o => !o)}
      >
        ◧
      </button>
      {open && (
        <div className="theme-menu" role="menu" aria-label="Theme presets">
          {THEMES.map(t => (
            <button
              key={t.name}
              type="button"
              className={`theme-menu-item ${theme === t.name ? 'active' : ''}`}
              onClick={() => {
                onThemeChange(t.name);
                setOpen(false);
              }}
            >
              <span className="theme-swatch" style={{ background: t.swatch }} />
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}