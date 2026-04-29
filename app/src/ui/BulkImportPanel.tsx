// Wave 27-C — design pass rewrite.
// Wave 45-F — progressive aria-live announcement during streaming.
// Semantic attributes preserved verbatim:
//   aria-label="bulk import"                          (section)
//   aria-label="bulk import files"                    (file input — now FileButton)
//   aria-label="bulk import progress"                 (table)
//   aria-live="polite" + aria-label="bulk import live progress" (running summary)
//   data-testid={`bulk-status-${i}`}                  (td)
//   role="status" aria-label="bulk import summary"    (p — terminal summary)
//
import { useState } from 'react';
import type { BulkResult, BulkSummary } from '../workflow/bulkImport';
import { Section } from './system/Section';
import { FileButton } from './system/FileButton';

export interface BulkImportPanelProps {
  /**
   * Called with the user-selected files. The panel streams per-file status
   * back via `onProgress` (invoked once per file, same order as the batch)
   * and the final summary via the returned promise.
   */
  onImport: (files: File[], onProgress: (result: BulkResult) => void) => Promise<BulkSummary>;
}

type Row =
  | { fileName: string; status: 'pending' }
  | (BulkResult & { status: 'ok' | 'skipped' | 'error' });

export function BulkImportPanel({ onImport }: BulkImportPanelProps): JSX.Element {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<BulkSummary | null>(null);

  async function onFiles(list: FileList): Promise<void> {
    if (list.length === 0) return;
    const files = Array.from(list);
    setBusy(true);
    setSummary(null);
    // For PDF inputs we get one progress event per file; for `.zip` inputs
    // we get one per top-level PDF entry, which the workflow streams in
    // arrival order. Append rows as results come in rather than pre-sizing
    // the table — the zip entry count is unknown until the archive is
    // walked.
    const initial: Row[] = files.map((f) => ({
      fileName: f.name,
      status: 'pending',
    }));
    setRows(initial);

    const results: Row[] = [];
    const finalSummary = await onImport(files, (result: BulkResult) => {
      results.push(result);
      setRows([...results]);
    });
    setSummary(finalSummary);
    setBusy(false);
  }

  return (
    <Section label="bulk import" className="space-y-3 px-4 py-4">
      <h2 className="text-heading uppercase text-fg-muted">Bulk import</h2>
      <p className="text-body text-fg-body">
        Select multiple PDF leases — or a single{' '}
        <code className="font-mono text-mono text-fg-muted">.zip</code> of PDFs — to analyze and
        save in one pass. Exact duplicates (by content hash) are skipped automatically. Top-level
        zip entries only; nested folders are ignored.
      </p>
      <FileButton
        variant="subtle"
        size="md"
        accept="application/pdf,application/zip,.pdf,.zip"
        multiple
        aria-label="bulk import files"
        disabled={busy}
        onFiles={(list) => void onFiles(list)}
      >
        Choose PDFs or .zip
      </FileButton>

      {rows.length > 0 &&
        (() => {
          // Wave 45-F — running summary above the table so SRs hear progress
          // as rows arrive, not only at the closing terminal summary below.
          const total = rows.length;
          const ok = rows.filter((r) => r.status === 'ok').length;
          const skipped = rows.filter((r) => r.status === 'skipped').length;
          const errors = rows.filter((r) => r.status === 'error').length;
          const processed = ok + skipped + errors;
          return (
            <p
              aria-live="polite"
              aria-atomic="false"
              aria-label="bulk import live progress"
              className="text-small text-fg-muted"
            >
              Processed {processed} of {total} · imported {ok} · skipped {skipped} · errors {errors}
            </p>
          );
        })()}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table
            aria-label="bulk import progress"
            className="w-full text-small text-fg-body border-collapse"
          >
            <thead>
              <tr className="border-b border-rule">
                <th scope="col" className="text-left py-1 pr-3 text-fg-muted font-sans">
                  File
                </th>
                <th scope="col" className="text-left py-1 pr-3 text-fg-muted font-sans">
                  Status
                </th>
                <th scope="col" className="text-left py-1 text-fg-muted font-sans">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.fileName}-${i}`}
                  className="even:bg-paper-sunken border-b border-rule-subtle"
                >
                  <td className="py-1 pr-3">{r.fileName}</td>
                  <td className="py-1 pr-3" data-testid={`bulk-status-${i}`}>
                    {labelFor(r.status)}
                  </td>
                  <td className="py-1">
                    <small className="font-mono text-mono text-fg-muted">{detailFor(r)}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {summary && (
        <p role="status" aria-label="bulk import summary" className="text-small text-fg-muted">
          Imported {summary.ok} · skipped {summary.skipped} · errors {summary.errors}.
        </p>
      )}
    </Section>
  );
}

function labelFor(status: Row['status']): string {
  switch (status) {
    case 'pending':
      return 'Pending…';
    case 'ok':
      return 'Imported';
    case 'skipped':
      return 'Skipped (duplicate)';
    case 'error':
      return 'Error';
  }
}

function detailFor(row: Row): string {
  if (row.status === 'pending') return '';
  if (row.status === 'ok') return row.leaseId ?? '';
  if (row.status === 'error') return row.error ?? '';
  return '';
}
