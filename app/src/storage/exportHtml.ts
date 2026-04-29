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

  const body = findings.length === 0 ? '<p class="empty">No findings detected.</p>' : sections;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(name)} · LeaseGuard findings</title>
<style>
  /* Marginalia palette inlined: exported HTML must render the same off any host. */
  body { font-family: 'Source Serif 4', 'Iowan Old Style', Georgia, serif; background: #faf6ee; color: #4a3f25; max-width: 65ch; margin: 0 auto; padding: 2rem 1rem; line-height: 1.55; }
  h1 { font-weight: 600; color: #2a2316; margin-bottom: 0.25rem; }
  h2, h3 { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #2a2316; }
  .meta { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #7a6f57; font-size: 0.8125rem; margin-bottom: 2rem; }
  section.sev { border-top: 1px solid #d6cdb6; padding-top: 1rem; margin-top: 1.5rem; }
  section.sev-high h2 { color: #b1442d; }
  section.sev-medium h2 { color: #b8862c; }
  section.sev-low h2 { color: #5a7a5a; }
  section.sev-info h2 { color: #6b7b8c; }
  blockquote { background: #f3eddc; border: 1px solid #d6cdb6; border-radius: 2px; margin: 0.5rem 0; padding: 0.5rem 0.75rem; color: #4a3f25; font-style: italic; }
  .empty { color: #7a6f57; }
  @media print {
    body { background: transparent; max-width: none; padding: 0; }
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
