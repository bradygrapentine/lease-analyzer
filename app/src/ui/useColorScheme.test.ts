import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColorScheme } from './useColorScheme';

// jsdom's `localStorage` in this project's test runtime is a stub without
// working get/set (see `accordionStorage.test.ts`). Install a simple
// in-memory shim per-test so we can exercise the hook.
function installMemoryLocalStorage(): void {
  const store = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => {
      store.delete(k);
    },
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
  };
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: shim,
  });
}

function stubMatchMedia(prefersDark = false) {
  return vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: query === '(prefers-color-scheme: dark)' ? prefersDark : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('useColorScheme', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    document.documentElement.removeAttribute('data-theme');
    stubMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('defaults to system when no preference is stored', () => {
    const { result } = renderHook(() => useColorScheme());
    expect(result.current.theme).toBe('system');
  });

  it('setTheme("dark") writes localStorage and applies data-theme', () => {
    const { result } = renderHook(() => useColorScheme());
    act(() => result.current.setTheme('dark'));
    expect(localStorage.getItem('lg.theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(result.current.theme).toBe('dark');
    expect(result.current.resolvedScheme).toBe('dark');
  });

  it('setTheme("light") writes localStorage and applies data-theme', () => {
    const { result } = renderHook(() => useColorScheme());
    act(() => result.current.setTheme('light'));
    expect(localStorage.getItem('lg.theme')).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('setTheme("system") removes the localStorage key', () => {
    localStorage.setItem('lg.theme', 'dark');
    const { result } = renderHook(() => useColorScheme());
    act(() => result.current.setTheme('system'));
    expect(localStorage.getItem('lg.theme')).toBeNull();
    expect(result.current.theme).toBe('system');
  });

  it('hydrates from localStorage on mount', () => {
    localStorage.setItem('lg.theme', 'dark');
    const { result } = renderHook(() => useColorScheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('resolves system → dark when prefers-color-scheme: dark matches', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useColorScheme());
    expect(result.current.theme).toBe('system');
    expect(result.current.resolvedScheme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('exports a callable hook (SSR guard sanity)', () => {
    expect(typeof useColorScheme).toBe('function');
  });
});
