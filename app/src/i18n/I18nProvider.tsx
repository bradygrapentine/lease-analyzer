import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { enMessages, formatMessage, type MessageKey, type Messages } from './messages';
import { es } from './locales/es';
import {
  I18nContext,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
  warnedI18nKeys,
  type I18nContextValue,
  type Locale,
} from './I18nContext';

/**
 * i18n provider with a strict three-step fallback chain:
 *   active locale → en → key string (with a one-time console warning).
 *
 * Locale is read from `localStorage.leaseguard.locale` and persisted on
 * change. Default is `'en'`. Storage failures (private browsing, quota)
 * never throw — the provider falls back to the in-memory value.
 *
 * Non-component exports (the context object, `useI18n`, and types) live
 * in `I18nContext.ts` so this file stays fast-refresh-clean.
 */

const CATALOGS: Record<Locale, Partial<Messages>> = {
  en: enMessages,
  es,
};

function readStoredLocale(): Locale {
  try {
    const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw && (SUPPORTED_LOCALES as readonly string[]).includes(raw)) {
      return raw as Locale;
    }
  } catch {
    // localStorage unavailable (private mode, SSR-ish jsdom edge); fall through.
  }
  return 'en';
}

function writeStoredLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Persistence is best-effort; the in-memory state is authoritative.
  }
}

interface I18nProviderProps {
  children: ReactNode;
  /** Override the initial locale; primarily for tests + Storybook. */
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(() => initialLocale ?? readStoredLocale());

  useEffect(() => {
    writeStoredLocale(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale): void => {
    setLocaleState(next);
  }, []);

  const t = useCallback(
    (key: MessageKey, params?: Record<string, string | number>): string => {
      const active = CATALOGS[locale];
      const fromActive = active[key];
      if (typeof fromActive === 'string') return formatMessage(fromActive, params);
      const fromEn = enMessages[key];
      if (typeof fromEn === 'string') return formatMessage(fromEn, params);
      if (!warnedI18nKeys.has(key)) {
        warnedI18nKeys.add(key);
        console.warn(
          `[i18n] missing message for key "${key}" in locale "${locale}" and en fallback`,
        );
      }
      return key;
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
