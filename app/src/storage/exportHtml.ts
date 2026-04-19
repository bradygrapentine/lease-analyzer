import type { LeaseDocument } from '../parser/types';
import type { Finding, Severity } from '../rules/types';

export interface HtmlExportInput {
  name: string;
  doc: LeaseDocument;
  findings: Finding[];
}

const SEVERITY_ORDER: Severity[] = ['high', 'medium', 'low', 'info'];
const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

export function exportFindingsHtml(input: HtmlExportInput): string {
  const { name, doc, findings } = input;
  const grouped = groupBySeverity(findings);
  const generatedAt = new Date().toISOString();

  const sections = SEVERITY_ORDER.map((sev) => {
    const group = grouped[sev];
    if (!group || group.length === 0) return '';
    return `
      <section class="sev sev-${sev}">
        <h2>${escapeHtml(SEVERITY_LABEL[sev])} (${group.length})</h2>
        <ol>
          ${group
            .map(
              (f) => `
            <li>
              <h3>${escapeHtml(f.title)}</h3>
              <p>${escapeHtml(f.explanation)}</p>
              <blockquote>${escapeHtml(f.snippet)}</blockquote>
              <small>Page ${f.page}${f.negated ? ' · possibly not applicable' : ''}</small>
            </li>
          `,
            )
            .join('')}
        </ol>
      </section>
    `;
  }).join('');

  const body =
    findings.length === 0
      ? '<p class="empty">No findings detected.</p>'
      : sections;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(name)} · LeaseGuard findings</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; max-width: 48rem; margin: 0 auto; padding: 2rem 1rem; color: #111; line-height: 1.5; }
  h1 { margin-bottom: 0.25rem; }
  .meta { color: #555; font-size: 0.9rem; margin-bottom: 2rem; }
  section.sev { border-top: 1px solid #ddd; padding-top: 1rem; margin-top: 1.5rem; }
  section.sev-high h2 { color: #b00020; }
  section.sev-medium h2 { color: #a35200; }
  blockquote { border-left: 3px solid #ccc; padding-left: 0.75rem; color: #333; font-style: italic; }
  .empty { color: #555; }
  @media print {
    body { max-width: none; padding: 0; }
    section.sev { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<h1>${escapeHtml(name)}</h1>
<p class="meta">
  ${doc.pages.length} page${doc.pages.length === 1 ? '' : 's'} ·
  ${findings.length} finding${findings.length === 1 ? '' : 's'} ·
  Generated ${generatedAt}
</p>
${body}
</body>
</html>`;
}

function groupBySeverity(findings: Finding[]): Record<Severity, Finding[]> {
  const out: Record<Severity, Finding[]> = { high: [], medium: [], low: [], info: [] };
  for (const f of findings) out[f.severity].push(f);
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
