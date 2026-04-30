import { useI18n } from '../i18n/I18nContext';
import { Button } from './system/Button';
import { OfflineDot } from './OfflineDot';

// Aria/data inventory:
//   role="tablist" + aria-label="view mode" (div) — Wave 29-E
//   role="tab" + aria-selected + aria-controls on each view-mode
//     button. aria-pressed retained for back-compat with existing
//     toggle-pill styling and tests that probe it.
//   aria-label="new lease" (Button — appears only when analyzed)
//   aria-label="lease file name" (filename pill — appears only when
//     analyzed; lets axe + screen readers identify the active doc)
//
// Wave 51-A — privacy `<details>` + locale picker + theme toggle
// moved to the Settings tab.
//
// Wave 51-B — header slimmed further: the upload `<input>` and the
// "Try sample" button moved to UploadView (rendered when the app is
// in the idle / empty state). The header now carries:
//   - wordmark (h1)
//   - filename pill + "New lease" reset (when analyzed)
//   - tab pills (current / portfolio / redline / settings)
//   - offline-on-device indicator
// Tests that uploaded a fresh PDF via the header now go through
// UploadView; tests that uploaded a *second* lease after analysis
// click "New lease" first.

export type AppViewMode = 'current' | 'portfolio' | 'redline' | 'audit' | 'settings';

interface AppHeaderProps {
  view: AppViewMode;
  showRedlineToggle: boolean;
  onViewChange: (next: AppViewMode) => void;
  /** Filename of the analyzed lease, or null if no lease is loaded. */
  fileName?: string | null;
  /** Reset back to the upload landing. Only rendered when fileName is set. */
  onNewLease?: () => void;
}

export function AppHeader({
  view,
  showRedlineToggle,
  onViewChange,
  fileName = null,
  onNewLease,
}: AppHeaderProps): JSX.Element {
  const { t } = useI18n();
  const hasLease = Boolean(fileName);
  return (
    <header className="bg-paper border-b border-rule px-4 py-3 flex flex-wrap items-center gap-3">
      <h1 className="text-display font-display text-fg" style={{ marginRight: 12 }}>
        {t('app.title')}
      </h1>

      {hasLease && fileName && (
        <span
          aria-label="lease file name"
          className="font-display italic text-small text-fg-muted truncate max-w-[36ch]"
        >
          {fileName}
        </span>
      )}

      <div role="tablist" aria-label="view mode" className="view-toggle flex gap-1 ml-auto">
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
          pressed={view === 'audit'}
          role="tab"
          id="viewmode-tab-audit"
          aria-selected={view === 'audit'}
          aria-controls="viewmode-panel-audit"
          onClick={() => onViewChange('audit')}
        >
          {t('header.view.audit')}
        </Button>
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

      <OfflineDot />

      {hasLease && onNewLease && (
        <Button type="button" variant="ghost" size="sm" aria-label="new lease" onClick={onNewLease}>
          New lease
        </Button>
      )}
    </header>
  );
}
