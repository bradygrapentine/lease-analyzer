import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expectAxeClean } from '../test/axe';
import { ThemeToggle } from './ThemeToggle';

// Mirror the shim used by `useColorScheme.test.ts` — jsdom's
// `localStorage` in this project's test runtime lacks working get/set.
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

function stubMatchMedia() {
  return vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
    document.documentElement.removeAttribute('data-theme');
    stubMatchMedia();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('cycles system → light → dark → system on click', async () => {
    render(<ThemeToggle />);
    const btn = screen.getByRole('button', { name: /^Theme:/ });
    expect(btn).toHaveAccessibleName(/system \(click for light\)/i);
    await userEvent.click(btn);
    expect(btn).toHaveAccessibleName(/light \(click for dark\)/i);
    await userEvent.click(btn);
    expect(btn).toHaveAccessibleName(/dark \(click for system\)/i);
    await userEvent.click(btn);
    expect(btn).toHaveAccessibleName(/system \(click for light\)/i);
  });

  it('persists the choice to localStorage', async () => {
    render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button')); // → light
    expect(localStorage.getItem('lg.theme')).toBe('light');
    await userEvent.click(screen.getByRole('button')); // → dark
    expect(localStorage.getItem('lg.theme')).toBe('dark');
    await userEvent.click(screen.getByRole('button')); // → system
    expect(localStorage.getItem('lg.theme')).toBeNull();
  });

  it('passes axe in dark mode', async () => {
    const { container } = render(<ThemeToggle />);
    await userEvent.click(screen.getByRole('button')); // → light
    await userEvent.click(screen.getByRole('button')); // → dark
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    await expectAxeClean(container);
  });
});
