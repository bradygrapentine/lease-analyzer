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
            The exported file carries a digital signature made with your local key. Share the
            8-character fingerprint shown next to your signing key (Settings, Signing key) with the
            recipient out-of-band: phone, encrypted message, or paper. The recipient computes the
            same SHA-256 fingerprint over the public key embedded in the signed export and checks
            the match. A match is evidence the embedded key was not substituted. It does not by
            itself prove identity.
          </p>
        </details>
      )}
    </>
  );
}
