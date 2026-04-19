export interface ClauseTemplate {
  id: string;
  name: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

export interface ClauseTemplateMatch {
  templateId: string;
  templateName: string;
  bestScore: number;
  matchedParagraphIndex: number | null;
  matchedPage: number | null;
  matchedSnippet: string | null;
}
