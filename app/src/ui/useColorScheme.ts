import { useCallback, useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';

const STORAGE_KEY = 'lg.theme';

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    // localStorage may be disabled (private browsing) or stubbed
    // (test runtime); treat any access failure as "no preference".
    return 'system';
  }
}

function resolve(theme: Theme): ResolvedScheme {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export interface UseColorSchemeReturn {
  theme: Theme;
  resolvedScheme: ResolvedScheme;
  setTheme: (theme: Theme) => void;
}

export function useColorScheme(): UseColorSchemeReturn {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [resolvedScheme, setResolved] = useState<ResolvedScheme>(() => resolve(readStoredTheme()));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const next = resolve(theme);
    setResolved(next);
    root.setAttribute('data-theme', next);

    if (theme !== 'system') return;
    if (typeof window.matchMedia !== 'function') return;
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
    } catch {
      return;
    }
    const onChange = () => {
      const r: ResolvedScheme = mq.matches ? 'dark' : 'light';
      setResolved(r);
      root.setAttribute('data-theme', r);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    if (typeof window !== 'undefined') {
      try {
        if (next === 'system') window.localStorage.removeItem(STORAGE_KEY);
        else window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage may be unavailable; the in-memory state still updates.
      }
    }
    setThemeState(next);
  }, []);

  return { theme, resolvedScheme, setTheme };
}
