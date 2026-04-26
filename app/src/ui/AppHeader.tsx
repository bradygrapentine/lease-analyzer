import { LocalePickerPanel } from './LocalePickerPanel';
import { useI18n } from '../i18n/I18nContext';

export type AppViewMode = 'current' | 'portfolio' | 'redline';

interface AppHeaderProps {
  view: AppViewMode;
  showRedlineToggle: boolean;
  onUpload: (file: File) => void | Promise<void>;
  onTrySample: () => void;
  onViewChange: (next: AppViewMode) => void;
}

export function AppHeader({
  view,
  showRedlineToggle,
  onUpload,
  onTrySample,
  onViewChange,
}: AppHeaderProps): JSX.Element {
  const { t } = useI18n();
  return (
    <header>
      <h1>{t('app.title')}</h1>
      <p>{t('app.tagline')}</p>
      <LocalePickerPanel />
      <details className="privacy">
        <summary>{t('header.privacy.summary')}</summary>
        <ul>
          <li>The PDF is parsed entirely in your browser via pdf.js.</li>
          <li>All storage is in IndexedDB on this device. No account, no sync.</li>
          <li>
            A strict Content-Security-Policy (<code>default-src &apos;self&apos;</code>) blocks this
            page from loading scripts, fonts, or data from any other origin.
          </li>
          <li>LeaseGuard is not legal advice. Findings are heuristic pattern matches.</li>
        </ul>
      </details>
      <label>
        <span className="visually-hidden">Upload lease</span>
        <input
          type="file"
          accept="application/pdf"
          aria-label="upload lease"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            await onUpload(file);
          }}
        />
      </label>
      <button type="button" onClick={onTrySample}>
        {t('header.trySample')}
      </button>
      <div role="group" aria-label="view mode" className="view-toggle">
        <button
          type="button"
          aria-pressed={view === 'current'}
          onClick={() => onViewChange('current')}
        >
          {t('header.view.current')}
        </button>
        <button
          type="button"
          aria-pressed={view === 'portfolio'}
          onClick={() => onViewChange('portfolio')}
        >
          {t('header.view.portfolio')}
        </button>
        {showRedlineToggle && (
          <button
            type="button"
            aria-pressed={view === 'redline'}
            onClick={() => onViewChange('redline')}
          >
            {t('header.view.redline')}
          </button>
        )}
      </div>
    </header>
  );
}
