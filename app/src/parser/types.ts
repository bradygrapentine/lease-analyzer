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
  /**
   * Indices into `LeaseDocument.paragraphs` for each entry in `paragraphs`,
   * in the same order. Added so consumers (e.g. `runSectionAnchored`) can
   * locate a section paragraph in the master array in O(1) instead of via
   * `indexOf`. Kept alongside the `paragraphs` refs to avoid churning UI
   * call sites that still use the refs.
   */
  paragraphIndexes: number[];
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
