import type { ChangeEvent } from 'react';
import { useI18n } from '../i18n/I18nContext';

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
    <footer>
      <button type="button" onClick={() => void onExportArchive()}>
        {t('footer.archive.export')}
      </button>
      <label>
        <span className="visually-hidden">Import encrypted archive</span>
        Import encrypted archive:
        <input
          type="file"
          accept=".lgarchive,application/octet-stream"
          aria-label="import encrypted archive"
          onChange={(e) => void onImportArchive(e)}
        />
      </label>
      <button type="button" onClick={onClearAll}>
        {t('footer.clearAll')}
      </button>
    </footer>
  );
}
