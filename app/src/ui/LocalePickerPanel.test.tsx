import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LocalePickerPanel } from './LocalePickerPanel';
import { I18nProvider } from '../i18n/I18nProvider';
import {
  LOCALE_STORAGE_KEY,
  useI18n,
  _resetI18nWarnedKeysForTests,
} from '../i18n/I18nContext';

function ActiveLocaleProbe(): JSX.Element {
  const { locale } = useI18n();
  return <span data-testid="active-locale">{locale}</span>;
}

describe('LocalePickerPanel', () => {
  beforeEach(() => {
    // See note in I18nProvider.test.tsx — install a working in-memory shim.
    const store = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
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
      } satisfies Storage,
    });
    _resetI18nWarnedKeysForTests();
  });

  it('renders a select with both supported locales', () => {
    render(
      <I18nProvider>
        <LocalePickerPanel />
      </I18nProvider>,
    );
    const select = screen.getByRole('combobox', { name: /language/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Español' })).toBeInTheDocument();
  });

  it('reflects the current locale as the selected option', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    render(
      <I18nProvider>
        <LocalePickerPanel />
      </I18nProvider>,
    );
    const select = screen.getByRole('combobox', { name: /idioma/i }) as HTMLSelectElement;
    expect(select.value).toBe('es');
  });

  it('persists the chosen locale to localStorage and updates the active locale', async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <LocalePickerPanel />
        <ActiveLocaleProbe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('active-locale').textContent).toBe('en');
    await user.selectOptions(
      screen.getByRole('combobox', { name: /language/i }),
      'es',
    );
    expect(screen.getByTestId('active-locale').textContent).toBe('es');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
  });
});
