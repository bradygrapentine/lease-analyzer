// Wave 30 Part B — accordion open/closed persistence.
//
// Per plan §1.4 and §5 Part B: bottom-pane accordions default *closed*,
// per-section open/closed state persists across reloads in `localStorage`
// keyed `lg.accordion.<sectionId>.open` with string value `'1'` (open) or
// `'0'` (closed). Presence of the key wins over the SectionGroup
// `defaultOpen` prop. SSR/jsdom-safe via a `typeof window` guard;
// `QuotaExceededError` is swallowed (UI prefs are best-effort).

const KEY_PREFIX = 'lg.accordion.';
const KEY_SUFFIX = '.open';

function storageKey(id: string): string {
  return `${KEY_PREFIX}${id}${KEY_SUFFIX}`;
}

/**
 * Read the persisted open/closed state for a section.
 *
 * Returns `true` / `false` when the key is present and well-formed,
 * `undefined` when no key is set, the value is malformed, or the
 * environment has no `localStorage` (SSR / older jsdom builds).
 */
export function readAccordionState(id: string): boolean | undefined {
  if (typeof window === 'undefined') return undefined;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(storageKey(id));
  } catch {
    return undefined;
  }
  if (raw === '1') return true;
  if (raw === '0') return false;
  return undefined;
}

/**
 * Persist the open/closed state for a section. Best-effort: failures
 * (e.g. `QuotaExceededError`, private-mode, disabled storage) are
 * swallowed — accordion preferences must never break the UI.
 */
export function writeAccordionState(id: string, open: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(id), open ? '1' : '0');
  } catch {
    // Quota exceeded / disabled storage — silently drop the preference.
  }
}
