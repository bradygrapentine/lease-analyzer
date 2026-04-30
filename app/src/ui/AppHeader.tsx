import { useI18n } from '../i18n/I18nContext';
import { Button } from './system/Button';
import { OfflineDot } from './OfflineDot';

// Aria/data inventory:
//   role="tablist" + aria-label="view mode" (div) — Wave 29-E
//   role="tab" + aria-selected + aria-controls on each view-mode
//     button. aria-pressed is intentionally NOT set — axe's
//     aria-allowed-attr forbids it on role="tab".
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
    <header className="bg-paper-raised border-b border-rule px-5 h-[52px] flex items-center gap-4">
      <div className="flex items-center gap-2.5">
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0">
          <rect
            x="3"
            y="2"
            width="14"
            height="18"
            stroke="var(--color-ink)"
            strokeWidth="1.4"
            fill="none"
          />
          <path
            d="M6 7 H14 M6 10 H12 M6 13 H14 M6 16 H10"
            stroke="var(--color-ink)"
            strokeWidth="1"
          />
          <path
            d="M16 12 L19 15 L16 18"
            stroke="var(--color-severity-medium)"
            strokeWidth="1.6"
            fill="none"
          />
        </svg>
        <h1 className="font-display text-[16px] font-semibold text-fg leading-none m-0">
          {t('app.title')}
        </h1>
      </div>

      {hasLease && fileName && (
        <>
          <span aria-hidden="true" className="h-[22px] w-px bg-rule" />
          <span
            aria-label="lease file name"
            className="font-display italic text-small text-fg-muted truncate max-w-[36ch] min-w-0 flex-1"
          >
            {fileName}
          </span>
        </>
      )}

      {!hasLease && <div className="flex-1" />}

      <div
        role="tablist"
        aria-label="view mode"
        className="view-toggle flex items-center gap-0 rounded-sm border border-rule bg-paper-sunken p-0.5"
      >
        <SegmentedTab
          view={view}
          target="current"
          label={t('header.view.current')}
          onClick={() => onViewChange('current')}
        />
        <SegmentedTab
          view={view}
          target="portfolio"
          label={t('header.view.portfolio')}
          onClick={() => onViewChange('portfolio')}
        />
        {showRedlineToggle && (
          <SegmentedTab
            view={view}
            target="redline"
            label={t('header.view.redline')}
            onClick={() => onViewChange('redline')}
          />
        )}
        <SegmentedTab
          view={view}
          target="audit"
          label={t('header.view.audit')}
          onClick={() => onViewChange('audit')}
        />
        <SegmentedTab
          view={view}
          target="settings"
          label={t('header.view.settings')}
          onClick={() => onViewChange('settings')}
        />
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

interface SegmentedTabProps {
  view: AppViewMode;
  target: AppViewMode;
  label: string;
  onClick: () => void;
}

function SegmentedTab({ view, target, label, onClick }: SegmentedTabProps): JSX.Element {
  const active = view === target;
  return (
    <button
      type="button"
      role="tab"
      id={`viewmode-tab-${target}`}
      aria-selected={active}
      aria-controls={`viewmode-panel-${target}`}
      onClick={onClick}
      className={`h-7 px-3 rounded-sm font-sans text-[12.5px] tracking-[0.01em] transition-colors focus-visible:focus-ring ${
        active
          ? 'bg-paper-raised border border-rule text-fg font-semibold'
          : 'border border-transparent text-fg-body hover:text-fg font-medium'
      }`}
    >
      {label}
    </button>
  );
}
