import { useCallback, useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
export type ResolvedScheme = 'light' | 'dark';

const STORAGE_KEY = 'lg.theme';

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
}

function resolve(theme: Theme): ResolvedScheme {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
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
      if (next === 'system') window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    }
    setThemeState(next);
  }, []);

  return { theme, resolvedScheme, setTheme };
}
