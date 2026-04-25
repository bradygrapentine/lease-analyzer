import type { ChangeEvent } from 'react';
import type { OcrLanguage } from '../ocr/availableLanguages';

export interface OcrLanguagePickerPanelProps {
  /**
   * Languages discovered from `/tesseract/languages.json`. An empty
   * array hides the panel entirely (no traineddata files provisioned).
   */
  available: OcrLanguage[];
  /** Currently-selected language code. */
  selected: string;
  onChange: (next: string) => void;
}

export function OcrLanguagePickerPanel({
  available,
  selected,
  onChange,
}: OcrLanguagePickerPanelProps): JSX.Element | null {
  if (available.length === 0) return null;

  if (available.length === 1) {
    // No choice to make — render a static label so the user still sees
    // which language OCR will run in, but no <select> is exposed.
    const only = available[0];
    if (!only) return null;
    return (
      <section aria-label="ocr language" className="ocr-language">
        <p>
          OCR language: <strong>{only.label}</strong>
        </p>
      </section>
    );
  }

  return (
    <section aria-label="ocr language" className="ocr-language">
      <label>
        <span>OCR language</span>
        <select
          aria-label="ocr language"
          value={selected}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        >
          {available.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
