import type { Finding, Severity } from '../rules/types';

export interface SummaryInput {
  leaseName: string;
  findings: Finding[];
}

export interface Summary {
  html: string;
  plain: string;
}

const SEVERITY_ORDER: Severity[] = ['high', 'medium', 'low', 'info'];
const SEVERITY_LABEL: Record<Severity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
};

export function buildSummary(input: SummaryInput): Summary {
  const { leaseName, findings } = input;
  const grouped = groupBySeverity(findings);

  if (findings.length === 0) {
    return {
      html:
        `<h1>${escHtml(leaseName)}</h1>` +
        `<p><em>No findings detected.</em></p>`,
      plain: `${leaseName}\n\nNo findings detected.\n`,
    };
  }

  const htmlParts: string[] = [`<h1>${escHtml(leaseName)}</h1>`];
  const plainParts: string[] = [leaseName, ''.padEnd(leaseName.length, '=')];

  for (const sev of SEVERITY_ORDER) {
    const group = grouped[sev];
    if (!group || group.length === 0) continue;
    const label = SEVERITY_LABEL[sev];
    htmlParts.push(`<h2>${label} (${group.length})</h2>`);
    htmlParts.push('<ul>');
    plainParts.push('', `${label} (${group.length})`);
    for (const finding of group) {
      htmlParts.push(
        '<li>' +
          `<strong>${escHtml(finding.title)}</strong>` +
          (finding.negated ? ' <em>(possibly not applicable)</em>' : '') +
          `<br>${escHtml(finding.explanation)}` +
          ` <small>p.${finding.page}</small>` +
          '</li>',
      );
      plainParts.push(
        `- ${finding.title}${finding.negated ? ' (possibly not applicable)' : ''} — ${finding.explanation} (p.${finding.page})`,
      );
    }
    htmlParts.push('</ul>');
  }

  return {
    html: htmlParts.join(''),
    plain: plainParts.join('\n') + '\n',
  };
}

export async function copyToClipboard(summary: Summary): Promise<void> {
  const nav = globalThis.navigator as
    | { clipboard?: { write?: (items: unknown[]) => Promise<void>; writeText?: (s: string) => Promise<void> } }
    | undefined;
  const clip = nav?.clipboard;
  if (!clip) {
    throw new Error('Clipboard API unavailable in this environment.');
  }
  const ClipItem = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
  if (ClipItem && typeof clip.write === 'function') {
    const htmlBlob = new Blob([summary.html], { type: 'text/html' });
    const plainBlob = new Blob([summary.plain], { type: 'text/plain' });
    const item = new ClipItem({
      'text/html': htmlBlob,
      'text/plain': plainBlob,
    });
    await clip.write([item]);
    return;
  }
  if (typeof clip.writeText === 'function') {
    await clip.writeText(summary.plain);
    return;
  }
  throw new Error('Clipboard API present but unusable (no write/writeText).');
}

function groupBySeverity(findings: Finding[]): Record<Severity, Finding[]> {
  const out: Record<Severity, Finding[]> = { high: [], medium: [], low: [], info: [] };
  for (const f of findings) out[f.severity].push(f);
  return out;
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
