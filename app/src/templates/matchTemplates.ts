import { similarity } from '../compare/similarity';
import type { LeaseDocument } from '../parser/types';
import type { ClauseTemplate, ClauseTemplateMatch } from './types';

const SNIPPET_MAX = 240;

export function matchTemplates(
  templates: ClauseTemplate[],
  doc: LeaseDocument,
): ClauseTemplateMatch[] {
  return templates.map((tpl) => matchOne(tpl, doc));
}

function matchOne(tpl: ClauseTemplate, doc: LeaseDocument): ClauseTemplateMatch {
  let bestScore = 0;
  let bestIndex: number | null = null;
  let bestPage: number | null = null;
  let bestSnippet: string | null = null;

  for (let i = 0; i < doc.paragraphs.length; i++) {
    const para = doc.paragraphs[i];
    if (!para) continue;
    const score = similarity(tpl.text, para.text);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = i;
      bestPage = para.page;
      bestSnippet =
        para.text.length > SNIPPET_MAX ? para.text.slice(0, SNIPPET_MAX) + '…' : para.text;
    }
  }

  return {
    templateId: tpl.id,
    templateName: tpl.name,
    bestScore,
    matchedParagraphIndex: bestIndex,
    matchedPage: bestPage,
    matchedSnippet: bestSnippet,
  };
}
