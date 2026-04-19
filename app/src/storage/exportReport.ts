import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';

export interface ExportInput {
  name: string;
  doc: LeaseDocument;
  findings: Finding[];
}

export const EXPORT_SCHEMA = 'leaseguard.findings.v1';

export function exportFindingsJson(input: ExportInput): string {
  const payload = {
    schema: EXPORT_SCHEMA,
    lease: {
      name: input.name,
      pageCount: input.doc.pages.length,
      paragraphCount: input.doc.paragraphs.length,
      sectionCount: input.doc.sections.length,
    },
    rulePackVersion: input.findings[0]?.rulePackVersion ?? null,
    findings: input.findings.map((f) => ({
      ruleId: f.ruleId,
      severity: f.severity,
      category: f.category,
      title: f.title,
      explanation: f.explanation,
      citation: f.citation,
      page: f.page,
      snippet: f.snippet,
      span: f.span,
      confidence: Number(f.confidence.toFixed(2)),
      negated: f.negated,
    })),
  };
  return JSON.stringify(payload, null, 2);
}
