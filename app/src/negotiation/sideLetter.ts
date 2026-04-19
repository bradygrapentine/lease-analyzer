import type { RedlineEdit } from '../redline/redline';

export interface SideLetterSigner {
  name: string;
  title?: string;
}

export interface SideLetterInput {
  leaseName: string;
  leaseDate?: string;
  edits: RedlineEdit[];
  /**
   * Caller-supplied mapping from a paragraph index to a section label like
   * "4.2". When `undefined` is returned, the clause is labeled by its
   * paragraph coordinates instead (e.g. `Page 3, \u00b6 14`).
   */
  sectionFor(paragraphIndex: number): string | undefined;
  signer?: SideLetterSigner;
}

/**
 * Produce the numbered clause list (as plain data) for both HTML and text
 * renderers. Duplicate paragraph indices are folded — only the first edit
 * per paragraph survives, matching the redline-store invariant that a
 * paragraph has at most one active edit at a time.
 */
interface Clause {
  label: string;
  before: string;
  after: string;
}

function buildClauses(input: SideLetterInput): Clause[] {
  const seen = new Set<number>();
  const clauses: Clause[] = [];
  for (const edit of input.edits) {
    if (seen.has(edit.paragraphIndex)) continue;
    seen.add(edit.paragraphIndex);
    const section = input.sectionFor(edit.paragraphIndex);
    const label = section
      ? `Section ${section}`
      : `Page N, \u00b6 ${edit.paragraphIndex + 1}`;
    clauses.push({ label, before: edit.before, after: edit.after });
  }
  return clauses;
}

export function buildSideLetterHtml(input: SideLetterInput): string {
  const { leaseName, leaseDate, signer } = input;
  const clauses = buildClauses(input);
  const dateLine = leaseDate
    ? `<p class="meta">Re: ${escapeHtml(leaseName)} (dated ${escapeHtml(leaseDate)})</p>`
    : `<p class="meta">Re: ${escapeHtml(leaseName)}</p>`;
  const body =
    clauses.length === 0
      ? `<p class="empty">No changes to propose.</p>`
      : `<ol class="clauses">${clauses
          .map(
            (c, i) =>
              `<li><strong>${i + 1}. ${escapeHtml(c.label)}.</strong> ` +
              `The parties agree that the text of ${escapeHtml(c.label)} is amended to read: ` +
              `&ldquo;${escapeHtml(c.after)}&rdquo;.</li>`,
          )
          .join('')}</ol>`;
  const signatureBlock = signer
    ? `<div class="sig">\n  <p>Sincerely,</p>\n  <p class="name">${escapeHtml(signer.name)}</p>${
        signer.title ? `\n  <p class="title">${escapeHtml(signer.title)}</p>` : ''
      }\n</div>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(leaseName)} \u00b7 side letter</title>
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; max-width: 48rem; margin: 0 auto; padding: 2rem 1rem; color: #111; line-height: 1.55; }
  h1 { margin-bottom: 0.25rem; }
  .meta { color: #555; font-size: 0.9rem; margin-bottom: 2rem; }
  ol.clauses li { margin-bottom: 1rem; }
  .empty { color: #555; font-style: italic; }
  .sig { margin-top: 3rem; }
  .sig .name { font-weight: 600; margin-bottom: 0; }
  .sig .title { color: #555; margin-top: 0; }
  @media print {
    body { max-width: none; padding: 0; }
    ol.clauses li { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<h1>Side Letter</h1>
${dateLine}
${body}
${signatureBlock}
</body>
</html>`;
}

export function buildSideLetterText(input: SideLetterInput): string {
  const { leaseName, leaseDate, signer } = input;
  const clauses = buildClauses(input);
  const header =
    `Side Letter\n` +
    `Re: ${leaseName}${leaseDate ? ` (dated ${leaseDate})` : ''}\n\n`;
  const body =
    clauses.length === 0
      ? 'No changes to propose.\n'
      : clauses
          .map(
            (c, i) =>
              `${i + 1}. ${c.label}. The parties agree that the text of ${c.label} is amended to read: "${c.after}".`,
          )
          .join('\n\n') + '\n';
  const sig = signer
    ? `\nSincerely,\n${signer.name}${signer.title ? `\n${signer.title}` : ''}\n`
    : '';
  return header + body + sig;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
