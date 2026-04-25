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

export interface Paragraph {
  text: string;
  page: number;
  bbox?: BoundingBox;
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
