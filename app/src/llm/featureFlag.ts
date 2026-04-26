// Wave 21 — Phase 18 feature flag. Off by default; enabled via either
// a URL search param (?phase18=on) or a localStorage entry (set with
// `setPhase18Override('on')` from a dev console). Pure read; no side
// effects on import.
//
// Why two channels? URL param survives a page refresh in dev without
// touching local state; localStorage persists across navigations
// without dirtying the URL. Either is sufficient — they OR together.

const STORAGE_KEY = 'leaseguard.phase18';

/**
 * Returns true iff Phase 18's hybrid analyze() path should run.
 * The deterministic rules engine still runs; this only gates whether
 * the optional classifier pass adds extra findings.
 */
export function isPhase18Enabled(): boolean {
  return readUrlParam() === 'on' || readStorage() === 'on';
}

/**
 * Test + dev-console helper. Pass 'on' / 'off' to override; null to
 * clear the override (returns to URL-only behavior).
 */
export function setPhase18Override(value: 'on' | 'off' | null): void {
  if (typeof localStorage === 'undefined') return;
  if (value === null) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, value);
}

function readUrlParam(): string | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('phase18');
  } catch {
    return null;
  }
}

function readStorage(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
