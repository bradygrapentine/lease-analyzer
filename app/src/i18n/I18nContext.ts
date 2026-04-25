import { createContext, useContext } from 'react';
import type { MessageKey } from './messages';

/**
 * Non-component exports for the i18n provider live here so the `.tsx`
 * file remains fast-refresh-clean (components only). See `CLAUDE.md`
 * → "React-refresh discipline".
 */

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_STORAGE_KEY = 'leaseguard.locale';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

// Module-scoped warn dedupe — shared with the provider so the test reset
// helper and the provider see the same set.
export const warnedI18nKeys = new Set<string>();

/**
 * Test-only: reset the module-scoped warned-keys set so a test can
 * assert the one-time warning behavior independently of test order.
 */
export function _resetI18nWarnedKeysForTests(): void {
  warnedI18nKeys.clear();
}
