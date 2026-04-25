import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { I18nProvider } from './I18nProvider';
import {
  LOCALE_STORAGE_KEY,
  useI18n,
  _resetI18nWarnedKeysForTests,
  type Locale,
} from './I18nContext';
import type { MessageKey } from './messages';

function Probe({ msgKey, params }: { msgKey: MessageKey; params?: Record<string, string | number> }): JSX.Element {
  const { t, locale, setLocale } = useI18n();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="value">{t(msgKey, params)}</span>
      <button type="button" onClick={() => setLocale('es')}>to-es</button>
      <button type="button" onClick={() => setLocale('en')}>to-en</button>
    </div>
  );
}

describe('I18nProvider', () => {
  // jsdom's `localStorage` in this project's test runtime is a stub
  // without working setItem/getItem (some other harness wins). Install a
  // simple in-memory shim per-test.
  function installMemoryLocalStorage(): Map<string, string> {
    const store = new Map<string, string>();
    const shim: Storage = {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
      key: (i) => Array.from(store.keys())[i] ?? null,
      removeItem: (k) => {
        store.delete(k);
      },
      setItem: (k, v) => {
        store.set(k, String(v));
      },
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: shim,
    });
    return store;
  }

  beforeEach(() => {
    installMemoryLocalStorage();
    _resetI18nWarnedKeysForTests();
  });

  it('defaults to en when no locale is stored', () => {
    render(
      <I18nProvider>
        <Probe msgKey="header.trySample" />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale').textContent).toBe('en');
    expect(screen.getByTestId('value').textContent).toBe('Try a sample lease');
  });

  it('reads the persisted locale from localStorage on mount', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    render(
      <I18nProvider>
        <Probe msgKey="header.trySample" />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale').textContent).toBe('es');
    expect(screen.getByTestId('value').textContent).toBe('Probar un contrato de ejemplo');
  });

  it('ignores an unknown locale in localStorage and falls back to en', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'klingon' satisfies string as Locale);
    render(
      <I18nProvider>
        <Probe msgKey="header.trySample" />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale').textContent).toBe('en');
  });

  it('updates t and persists when setLocale is called', async () => {
    const userEvent = (await import('@testing-library/user-event')).default;
    const user = userEvent.setup();
    render(
      <I18nProvider>
        <Probe msgKey="header.trySample" />
      </I18nProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'to-es' }));
    expect(screen.getByTestId('locale').textContent).toBe('es');
    expect(screen.getByTestId('value').textContent).toBe('Probar un contrato de ejemplo');
    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es');
  });

  it('falls back to en when the active locale is missing a key', () => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    render(
      <I18nProvider>
        {/* `findings.empty` is in en but not in the es stub. */}
        <Probe msgKey="findings.empty" />
      </I18nProvider>,
    );
    expect(screen.getByTestId('value').textContent).toBe('No findings yet.');
  });

  it('substitutes params via formatMessage', () => {
    render(
      <I18nProvider>
        <Probe msgKey="status.analyzing" params={{ fileName: 'lease.pdf' }} />
      </I18nProvider>,
    );
    expect(screen.getByTestId('value').textContent).toBe('Analyzing lease.pdf…');
  });

  it('logs once and returns the key string when missing in both active and en', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    function MissingProbe(): JSX.Element {
      const { t } = useI18n();
      // Cast: deliberately probing the missing-key path that real callers
      // can't hit through types alone.
      return <span data-testid="missing">{t('not.a.real.key' as unknown as MessageKey)}</span>;
    }
    render(
      <I18nProvider>
        <MissingProbe />
      </I18nProvider>,
    );
    expect(screen.getByTestId('missing').textContent).toBe('not.a.real.key');
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('throws when useI18n is used outside the provider', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bare(): JSX.Element {
      useI18n();
      return <span />;
    }
    expect(() => render(<Bare />)).toThrow(/useI18n must be used inside/);
    errSpy.mockRestore();
  });

  it('respects initialLocale prop for tests/storybook', () => {
    render(
      <I18nProvider initialLocale="es">
        <Probe msgKey="header.trySample" />
      </I18nProvider>,
    );
    expect(screen.getByTestId('locale').textContent).toBe('es');
  });

  it('act/setLocale updates downstream consumers', () => {
    let setLocaleRef: ((l: Locale) => void) | null = null;
    function Capture(): JSX.Element {
      const { setLocale, locale } = useI18n();
      setLocaleRef = setLocale;
      return <span data-testid="cap-locale">{locale}</span>;
    }
    render(
      <I18nProvider>
        <Capture />
      </I18nProvider>,
    );
    expect(screen.getByTestId('cap-locale').textContent).toBe('en');
    act(() => {
      setLocaleRef?.('es');
    });
    expect(screen.getByTestId('cap-locale').textContent).toBe('es');
  });
});
