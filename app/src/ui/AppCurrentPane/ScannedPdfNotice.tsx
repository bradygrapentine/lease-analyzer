// Wave 45-BE — extracted from AppCurrentPane.tsx (lines 153-185). The
// scanned-PDF status banner: contains the OCR controls, language picker,
// progress, and error landmarks. Caller passes the result of
// `needsOcr(doc)`; this region returns null when the doc isn't likely
// scanned. Aria landmarks preserved verbatim:
//   role="status"           (outer banner div)
//   aria-live="polite"      (progress paragraph)
//   role="alert"            (error paragraph)

import type { OcrLanguage } from '../../ocr/availableLanguages';
import type { OcrVerdict } from '../../compare/needsOcr';
import { Button } from '../system/Button';
import { Badge } from '../system/Badge';
import { OcrLanguagePickerPanel } from '../OcrLanguagePickerPanel';

type OcrState =
  | { kind: 'idle' }
  | { kind: 'running'; pct: number; stage: string }
  | { kind: 'error'; message: string };

export interface ScannedPdfNoticeProps {
  ocr: OcrVerdict;
  ocrState: OcrState;
  ocrLanguage: string;
  ocrLanguages: OcrLanguage[];
  setOcrLanguage: (next: string) => void;
  hasBytes: boolean;
  onAttemptOcr: () => void;
}

export function ScannedPdfNotice({
  ocr,
  ocrState,
  ocrLanguage,
  ocrLanguages,
  setOcrLanguage,
  hasBytes,
  onAttemptOcr,
}: ScannedPdfNoticeProps): JSX.Element | null {
  if (!ocr.likelyScanned) return null;
  return (
    <div
      role="status"
      className="ocr-banner bg-paper-sunken border border-rule rounded-sm p-3 mb-3 space-y-2"
    >
      <p className="text-body text-fg-body">
        This PDF looks scanned (avg {Math.round(ocr.avgCharsPerPage)} chars/page). Text extraction
        may be incomplete.
      </p>
      {hasBytes && ocrState.kind !== 'running' && (
        <Button type="button" variant="subtle" size="sm" onClick={onAttemptOcr}>
          Attempt OCR
        </Button>
      )}
      <OcrLanguagePickerPanel
        available={ocrLanguages}
        selected={ocrLanguage}
        onChange={setOcrLanguage}
      />
      {ocrState.kind === 'running' && (
        <p aria-live="polite" className="ocr-progress text-body text-fg-body">
          Running OCR: {ocrState.stage} ({Math.round(ocrState.pct * 100)}%)
        </p>
      )}
      {ocrState.kind === 'error' && (
        <>
          {/* Wave 45-BE — pair the alert paragraph with a severity badge so
              the signal is icon + label + tinted background, not color alone
              (WCAG 1.4.1). The role="alert" stays on the body text so screen
              readers announce the message, not the badge label. */}
          <Badge variant="severity" severity="high">
            OCR failed
          </Badge>
          <p role="alert" className="text-body text-severity-high">
            OCR didn&rsquo;t finish reading this PDF. The error was: {ocrState.message}. Clauses on
            scanned pages may not appear in findings. You can try a different language pack from
            the picker above, or use the original PDF if its text is selectable.
          </p>
        </>
      )}
    </div>
  );
}
