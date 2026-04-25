import type { ChangeEvent } from 'react';
import {
  SUPPORTED_LOCALES,
  useI18n,
  type Locale,
} from '../i18n/I18nContext';

/**
 * Header-mounted locale picker. Reads/writes locale through the i18n
 * context (which persists to `localStorage.leaseguard.locale`). Renders
 * as a `<select>` so it stays compact next to the existing nav and is
 * keyboard-operable for free.
 */
export function LocalePickerPanel(): JSX.Element {
  const { locale, setLocale, t } = useI18n();

  function onChange(e: ChangeEvent<HTMLSelectElement>): void {
    const next = e.target.value;
    if ((SUPPORTED_LOCALES as readonly string[]).includes(next)) {
      setLocale(next as Locale);
    }
  }

  return (
    <label className="locale-picker">
      <span className="visually-hidden">{t('locale.picker.label')}</span>
      <select
        aria-label={t('locale.picker.label')}
        value={locale}
        onChange={onChange}
      >
        <option value="en">{t('locale.picker.en')}</option>
        <option value="es">{t('locale.picker.es')}</option>
      </select>
    </label>
  );
}
