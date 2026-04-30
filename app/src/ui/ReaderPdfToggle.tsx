import { useI18n } from '../i18n/I18nContext';

export type ReaderPdfMode = 'reader' | 'pdf';

interface Props {
  mode: ReaderPdfMode;
  onChange: (next: ReaderPdfMode) => void;
}

/**
 * Wave 51-C — segmented control for switching the analyzed-view document
 * surface between the marginalia reader (default) and the original PDF.
 * Per-session state lives in the parent (`AppCurrentPane`); no IDB write.
 */
export function ReaderPdfToggle({ mode, onChange }: Props): JSX.Element {
  const { t } = useI18n();
  return (
    <div
      role="tablist"
      aria-label={t('reader.toggle.label')}
      className="inline-flex items-center gap-1 rounded-sm border border-rule bg-paper-sunken p-1 text-mono text-fg-muted"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'reader'}
        onClick={() => onChange('reader')}
        className={
          'px-3 py-1 rounded-sm text-mono uppercase tracking-wider transition-colors ' +
          (mode === 'reader' ? 'bg-paper text-fg' : 'hover:text-fg')
        }
      >
        {t('reader.toggle.reader')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'pdf'}
        onClick={() => onChange('pdf')}
        className={
          'px-3 py-1 rounded-sm text-mono uppercase tracking-wider transition-colors ' +
          (mode === 'pdf' ? 'bg-paper text-fg' : 'hover:text-fg')
        }
      >
        {t('reader.toggle.pdf')}
      </button>
    </div>
  );
}
