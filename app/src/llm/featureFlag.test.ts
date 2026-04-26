import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { isPhase18Enabled, setPhase18Override } from './featureFlag';

const ORIGINAL_LOCATION = window.location;
let store: Map<string, string>;

beforeEach(() => {
  // Node 25's built-in localStorage stub is incomplete (no removeItem);
  // replace with a fresh in-memory Storage for each test.
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (n: number) => Array.from(store.keys())[n] ?? null,
    get length() {
      return store.size;
    },
  });
  Object.defineProperty(window, 'location', {
    value: new URL('http://localhost/'),
    writable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', { value: ORIGINAL_LOCATION, writable: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('isPhase18Enabled', () => {
  it('returns false by default (no URL param, no localStorage)', () => {
    expect(isPhase18Enabled()).toBe(false);
  });

  it('returns true when ?phase18=on is in the URL', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?phase18=on'),
      writable: true,
    });
    expect(isPhase18Enabled()).toBe(true);
  });

  it('returns false when ?phase18=off is in the URL', () => {
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?phase18=off'),
      writable: true,
    });
    expect(isPhase18Enabled()).toBe(false);
  });

  it('returns true when localStorage has phase18 set to "on"', () => {
    setPhase18Override('on');
    expect(isPhase18Enabled()).toBe(true);
  });

  it('returns false when localStorage has phase18 set to anything else', () => {
    setPhase18Override('off');
    expect(isPhase18Enabled()).toBe(false);
  });

  it('URL "on" overrides localStorage "off" (OR semantics)', () => {
    setPhase18Override('off');
    Object.defineProperty(window, 'location', {
      value: new URL('http://localhost/?phase18=on'),
      writable: true,
    });
    expect(isPhase18Enabled()).toBe(true);
  });

  it('localStorage "on" overrides absent URL param', () => {
    setPhase18Override('on');
    expect(isPhase18Enabled()).toBe(true);
  });

  it('setPhase18Override(null) clears the persisted override', () => {
    setPhase18Override('on');
    expect(isPhase18Enabled()).toBe(true);
    setPhase18Override(null);
    expect(isPhase18Enabled()).toBe(false);
  });
});
