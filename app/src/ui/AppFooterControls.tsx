// Wave 27-C — design pass rewrite.
// Semantic attributes preserved verbatim:
//   aria-label="import encrypted archive" (on the file input)
//
import type { ChangeEvent } from 'react';
import { useI18n } from '../i18n/I18nContext';
import { Button } from './system/Button';
import { FileButton } from './system/FileButton';

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
      <FileButton
        variant="subtle"
        size="sm"
        accept=".lgarchive,application/octet-stream"
        aria-label="import encrypted archive"
        onFiles={(files) => {
          // Adapter: the existing onImportArchive expects a ChangeEvent because
          // it was wired against a raw <input type="file">. Synthesize a
          // minimal compatible event so we don't ripple this rename out.
          const synthetic = {
            target: { files },
            currentTarget: { files },
          } as unknown as ChangeEvent<HTMLInputElement>;
          void onImportArchive(synthetic);
        }}
      >
        Import encrypted archive
      </FileButton>
      <Button variant="ghost" size="sm" onClick={onClearAll}>
        {t('footer.clearAll')}
      </Button>
    </footer>
  );
}
