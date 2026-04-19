import type { LeaseDocument } from '../parser/types';

export interface OcrVerdict {
  likelyScanned: boolean;
  avgCharsPerPage: number;
  threshold: number;
}

export const OCR_CHAR_THRESHOLD = 100;

export function needsOcr(doc: LeaseDocument): OcrVerdict {
  if (doc.pages.length === 0) {
    return { likelyScanned: false, avgCharsPerPage: 0, threshold: OCR_CHAR_THRESHOLD };
  }
  const totalChars = doc.pages.reduce(
    (sum, page) => sum + page.items.reduce((pSum, item) => pSum + item.text.length, 0),
    0,
  );
  const avg = totalChars / doc.pages.length;
  return {
    likelyScanned: avg < OCR_CHAR_THRESHOLD,
    avgCharsPerPage: avg,
    threshold: OCR_CHAR_THRESHOLD,
  };
}
