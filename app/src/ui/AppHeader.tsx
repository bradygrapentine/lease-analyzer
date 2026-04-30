import { useI18n } from '../i18n/I18nContext';
import { Button } from './system/Button';

// Aria/data inventory (preserved verbatim):
//   aria-label="upload lease" (input)
//   role="tablist" + aria-label="view mode" (div) — Wave 29-E
//   role="tab" + aria-selected + aria-controls on each view-mode
//     button. aria-pressed retained for back-compat with existing
//     toggle-pill styling and tests that probe it.
//
// Wave 51-A — locale picker, theme toggle, and the privacy disclosure
// move under the new Settings tab. The header keeps the upload control
// + sample-lease button + view-mode tablist; Wave 51-B will further
// slim it once the marginalia upload landing lands.

export type AppViewMode = 'current' | 'portfolio' | 'redline' | 'settings';

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
        <div role="tablist" aria-label="view mode" className="view-toggle flex gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            pressed={view === 'current'}
            role="tab"
            id="viewmode-tab-current"
            aria-selected={view === 'current'}
            aria-controls="viewmode-panel-current"
            onClick={() => onViewChange('current')}
          >
            {t('header.view.current')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            pressed={view === 'portfolio'}
            role="tab"
            id="viewmode-tab-portfolio"
            aria-selected={view === 'portfolio'}
            aria-controls="viewmode-panel-portfolio"
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
              role="tab"
              id="viewmode-tab-redline"
              aria-selected={view === 'redline'}
              aria-controls="viewmode-panel-redline"
              onClick={() => onViewChange('redline')}
            >
              {t('header.view.redline')}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            pressed={view === 'settings'}
            role="tab"
            id="viewmode-tab-settings"
            aria-selected={view === 'settings'}
            aria-controls="viewmode-panel-settings"
            onClick={() => onViewChange('settings')}
          >
            {t('header.view.settings')}
          </Button>
        </div>
      </div>
    </header>
  );
}
