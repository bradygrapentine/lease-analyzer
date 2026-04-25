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
   * Authoritative for index-based lookups; `paragraphs` is kept for callers
   * that need the objects themselves. */
  paragraphIndices: number[];
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
