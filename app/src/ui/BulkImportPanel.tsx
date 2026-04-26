import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { BulkResult, BulkSummary } from '../workflow/bulkImport';

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
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const list = e.target.files;
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    // Reset the input so re-selecting the same batch re-fires.
    e.target.value = '';

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
    <section aria-label="bulk import">
      <h2>Bulk import</h2>
      <p>
        Select multiple PDF leases — or a single <code>.zip</code> of PDFs — to analyze and save in
        one pass. Exact duplicates (by content hash) are skipped automatically. Top-level zip
        entries only; nested folders are ignored.
      </p>
      <label>
        <span className="visually-hidden">Bulk import files</span>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,application/zip,.pdf,.zip"
          multiple
          aria-label="bulk import files"
          disabled={busy}
          onChange={(e) => void onFileChange(e)}
        />
      </label>

      {rows.length > 0 && (
        <table aria-label="bulk import progress">
          <thead>
            <tr>
              <th scope="col">File</th>
              <th scope="col">Status</th>
              <th scope="col">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.fileName}-${i}`}>
                <td>{r.fileName}</td>
                <td data-testid={`bulk-status-${i}`}>{labelFor(r.status)}</td>
                <td>
                  <small>{detailFor(r)}</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {summary && (
        <p role="status" aria-label="bulk import summary">
          Imported {summary.ok} · skipped {summary.skipped} · errors {summary.errors}.
        </p>
      )}
    </section>
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
