// Wave 45-BE — extracted from AppCurrentPane.tsx (lines 117-152). The
// post-analysis "what do I do with these findings" header: three export
// actions plus the Wave 45-D signed-export disclosure. Pure presentational
// — the parent supplies all callbacks (no App/appHelpers import).

import { useI18n } from '../../i18n/I18nContext';
import { Button } from '../system/Button';

export interface ResultsHeaderProps {
  hasSigningKey: boolean;
  onExportJson: () => void;
  onExportSignedJson: () => void;
  onExportHtml: () => void;
}

export function ResultsHeader({
  hasSigningKey,
  onExportJson,
  onExportSignedJson,
  onExportHtml,
}: ResultsHeaderProps): JSX.Element {
  const { t } = useI18n();
  return (
    <>
      <div className="results-actions flex flex-wrap gap-2 mb-3">
        <Button type="button" variant="subtle" size="sm" onClick={onExportJson}>
          {t('findings.export.json')}
        </Button>
        <Button type="button" variant="subtle" size="sm" onClick={onExportHtml}>
          {t('findings.export.html')}
        </Button>
        {hasSigningKey && (
          <Button type="button" variant="subtle" size="sm" onClick={onExportSignedJson}>
            {t('findings.export.signed')}
          </Button>
        )}
      </div>
      {hasSigningKey && (
        <details className="text-small text-fg-muted mb-3">
          <summary className="cursor-pointer select-none">What is signed export?</summary>
          <p className="mt-1 max-w-prose">
            The exported file carries a digital signature made with your local key. To use it as
            proof of origin, share your public key with the recipient out-of-band; they compare it
            against the key embedded in the signed export. Without that comparison step, the file
            only verifies against its own embedded key, which an attacker could replace.
          </p>
        </details>
      )}
    </>
  );
}
