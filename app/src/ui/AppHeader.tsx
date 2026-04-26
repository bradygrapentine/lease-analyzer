import { LocalePickerPanel } from './LocalePickerPanel';
import { useI18n } from '../i18n/I18nContext';
import { Button } from './system/Button';

// Aria/data inventory (preserved verbatim):
//   aria-label="upload lease" (input)
//   role="group" + aria-label="view mode" (div)
//   aria-pressed={...} on each view-mode button (3 buttons)

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
    <header className="bg-paper border-b border-rule px-4 py-3 space-y-2">
      <div className="flex items-baseline gap-3">
        <h1 className="text-display font-display text-fg">{t('app.title')}</h1>
        <p className="text-small text-fg-muted">{t('app.tagline')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <LocalePickerPanel />
        <details className="privacy text-small text-fg-muted">
          <summary className="cursor-pointer">{t('header.privacy.summary')}</summary>
          <ul className="mt-1 ml-4 space-y-0.5 list-disc text-fg-faint">
            <li>The PDF is parsed entirely in your browser via pdf.js.</li>
            <li>All storage is in IndexedDB on this device. No account, no sync.</li>
            <li>
              A strict Content-Security-Policy (<code>default-src &apos;self&apos;</code>) blocks this
              page from loading scripts, fonts, or data from any other origin.
            </li>
            <li>LeaseGuard is not legal advice. Findings are heuristic pattern matches.</li>
          </ul>
        </details>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1 text-body text-fg-body cursor-pointer">
          <span className="visually-hidden">Upload lease</span>
          <input
            type="file"
            accept="application/pdf"
            aria-label="upload lease"
            className="text-small"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await onUpload(file);
            }}
          />
        </label>
        <Button type="button" variant="default" size="sm" onClick={onTrySample}>
          {t('header.trySample')}
        </Button>
        <div role="group" aria-label="view mode" className="view-toggle flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            pressed={view === 'current'}
            aria-pressed={view === 'current'}
            onClick={() => onViewChange('current')}
          >
            {t('header.view.current')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            pressed={view === 'portfolio'}
            aria-pressed={view === 'portfolio'}
            onClick={() => onViewChange('portfolio')}
          >
            {t('header.view.portfolio')}
          </Button>
          {showRedlineToggle && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              pressed={view === 'redline'}
              aria-pressed={view === 'redline'}
              onClick={() => onViewChange('redline')}
            >
              {t('header.view.redline')}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
