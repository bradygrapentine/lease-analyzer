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

export interface Paragraph {
  text: string;
  page: number;
}

export interface Section {
  heading: string;
  number: string | null;
  paragraphs: Paragraph[];
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
