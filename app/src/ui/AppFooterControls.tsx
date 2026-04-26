// Wave 27-C — design pass rewrite.
// Semantic attributes preserved verbatim:
//   aria-label="import encrypted archive" (on the file input)
//
import type { ChangeEvent } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { Button } from './system/Button';

interface AppFooterControlsProps {
  onExportArchive: () => void | Promise<void>;
  onImportArchive: (e: ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onClearAll: () => void;
}

export function AppFooterControls({
  onExportArchive,
  onImportArchive,
  onClearAll,
}: AppFooterControlsProps): JSX.Element {
  const { t } = useI18n();
  return (
    <footer className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-rule bg-paper-sunken">
      <Button variant="subtle" size="sm" onClick={() => void onExportArchive()}>
        {t('footer.archive.export')}
      </Button>
      <label className="inline-flex items-center gap-2 text-small text-fg-muted cursor-pointer">
        <span className="sr-only">Import encrypted archive</span>
        <span className="inline-flex h-7 items-center px-2 rounded-sm border border-rule bg-paper-raised text-small text-fg-body hover:bg-paper-sunken transition-colors">
          Import encrypted archive
        </span>
        <input
          type="file"
          accept=".lgarchive,application/octet-stream"
          aria-label="import encrypted archive"
          className="sr-only"
          onChange={(e) => void onImportArchive(e)}
        />
      </label>
      <Button variant="ghost" size="sm" onClick={onClearAll}>
        {t('footer.clearAll')}
      </Button>
    </footer>
  );
}
