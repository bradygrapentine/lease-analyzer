export interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface PageText {
  pageNumber: number;
  width: number;
  height: number;
  items: TextItem[];
}

export interface BoundingBox {
  page: number;
  xLeft: number;
  xRight: number;
  yTop: number; // PDF coords: larger y is higher on the page
  yBottom: number;
}

export interface LineSpan {
  /** char offset within the parent Paragraph.text where this line begins */
  start: number;
  /** char offset within the parent Paragraph.text where this line ends (exclusive) */
  end: number;
  /** PDF-page bbox in PDF user-space units (same coordinate system as Paragraph.bbox) */
  bbox: BoundingBox;
}

export interface Paragraph {
  text: string;
  page: number;
  bbox?: BoundingBox;
  /** Wave 28: per-line spans for span-level highlight. Optional — legacy
   *  paragraphs lack this and the viewer falls back to paragraph bbox. */
  lines?: LineSpan[];
}

export interface Section {
  heading: string;
  number: string | null;
  paragraphs: Paragraph[];
  /** Positions of `paragraphs` in the parent `LeaseDocument.paragraphs` array.
   * Optional for backward compat with persisted/imported leases that predate
   * this field; matchers fall back to deriving indices via lookup when absent. */
  paragraphIndices?: number[];
  startPage: number;
}

export interface LeaseDocument {
  pages: PageText[];
  paragraphs: Paragraph[];
  sections: Section[];
  raw: string;
}

export class PasswordProtectedPdfError extends Error {
  constructor() {
    super('This PDF is password-protected. Unlock it and try again.');
    this.name = 'PasswordProtectedPdfError';
  }
}
