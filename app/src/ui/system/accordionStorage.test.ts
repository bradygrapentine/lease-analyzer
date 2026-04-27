// Wave 30 Part B — unit coverage for the accordion persistence helper.
//
// Covers:
//   - default (no key) → undefined
//   - stored '1' → true
//   - stored '0' → false
//   - malformed value → undefined (does NOT throw)
//   - write round-trip through localStorage
//   - SSR-style guard when `window` is missing
//   - quota / disabled-storage swallowed on write
//   - thrown getItem / removed storage swallowed on read

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readAccordionState, writeAccordionState } from './accordionStorage';

const ID = 'bottom-pane-this-lease';
const KEY = `lg.accordion.${ID}.open`;

// jsdom's `localStorage` in this project's test runtime is a stub without
// working get/set (see `I18nProvider.test.tsx` for the same fixup). Install
// a simple in-memory shim per-test so we can exercise the helper.
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

describe('accordionStorage', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('readAccordionState', () => {
    it('returns undefined when no key has been set (default-closed flow)', () => {
      expect(readAccordionState(ID)).toBeUndefined();
    });

    it("returns true when the stored value is '1'", () => {
      window.localStorage.setItem(KEY, '1');
      expect(readAccordionState(ID)).toBe(true);
    });

    it("returns false when the stored value is '0'", () => {
      window.localStorage.setItem(KEY, '0');
      expect(readAccordionState(ID)).toBe(false);
    });

    it('returns undefined for malformed values (e.g. "true", "yes", "")', () => {
      for (const garbage of ['true', 'false', 'yes', '', '2']) {
        window.localStorage.setItem(KEY, garbage);
        expect(readAccordionState(ID)).toBeUndefined();
      }
    });

    it('swallows getItem throws (e.g. SecurityError in some browsers)', () => {
      const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(readAccordionState(ID)).toBeUndefined();
      spy.mockRestore();
    });

    it('SSR guard: returns undefined when `window` is undefined', () => {
      // Simulate an SSR-shaped environment by stubbing the global.
      // Cast to keep TypeScript happy in a strict-globalThis world.
      const realWindow = (globalThis as { window?: unknown }).window;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).window = undefined;
      try {
        expect(readAccordionState(ID)).toBeUndefined();
      } finally {
        (globalThis as { window?: unknown }).window = realWindow;
      }
    });
  });

  describe('writeAccordionState', () => {
    it("writes '1' for open=true and '0' for open=false", () => {
      writeAccordionState(ID, true);
      expect(window.localStorage.getItem(KEY)).toBe('1');
      writeAccordionState(ID, false);
      expect(window.localStorage.getItem(KEY)).toBe('0');
    });

    it('round-trips through readAccordionState', () => {
      writeAccordionState(ID, true);
      expect(readAccordionState(ID)).toBe(true);
      writeAccordionState(ID, false);
      expect(readAccordionState(ID)).toBe(false);
    });

    it('swallows QuotaExceededError without throwing', () => {
      const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        const err = new Error('QuotaExceeded');
        err.name = 'QuotaExceededError';
        throw err;
      });
      expect(() => writeAccordionState(ID, true)).not.toThrow();
      spy.mockRestore();
    });

    it('SSR guard: no-ops when `window` is undefined', () => {
      const realWindow = (globalThis as { window?: unknown }).window;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).window = undefined;
      try {
        expect(() => writeAccordionState(ID, true)).not.toThrow();
      } finally {
        (globalThis as { window?: unknown }).window = realWindow;
      }
      // and the real localStorage was untouched
      expect(window.localStorage.getItem(KEY)).toBeNull();
    });

    it('uses distinct keys per section id (no cross-talk)', () => {
      writeAccordionState('a', true);
      writeAccordionState('b', false);
      expect(readAccordionState('a')).toBe(true);
      expect(readAccordionState('b')).toBe(false);
    });
  });
});
