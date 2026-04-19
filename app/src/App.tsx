import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { analyzeFile, type AnalysisResult } from './ui/analyzeFile';
import { FindingsPanel } from './ui/FindingsPanel';
import { LibraryPanel } from './ui/LibraryPanel';
import { PdfViewer } from './ui/PdfViewer';
import { ComparePanel } from './ui/ComparePanel';
import { LibraryCompareForm } from './ui/LibraryCompareForm';
import { needsOcr } from './compare/needsOcr';
import type { LeaseRecord } from './storage/storage';
import { PasswordProtectedPdfError } from './parser/types';
import type { Finding } from './rules/types';
import {
  clearAll,
  deleteLease,
  getLease,
  listLeases,
  saveLease,
  type LeaseMetadata,
} from './storage/storage';
import { exportFindingsJson } from './storage/exportReport';
import { exportFindingsHtml } from './storage/exportHtml';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading'; fileName: string }
  | { kind: 'analyzed'; fileName: string; result: AnalysisResult; bytes: Uint8Array | null }
  | { kind: 'error'; message: string };

export function App(): JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [selected, setSelected] = useState<Finding | null>(null);
  const [library, setLibrary] = useState<LeaseMetadata[]>([]);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [comparison, setComparison] = useState<{ a: LeaseRecord; b: LeaseRecord } | null>(null);

  const refreshLibrary = useCallback(async () => {
    setLibrary(await listLeases());
  }, []);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus({ kind: 'loading', fileName: file.name });
    setSelected(null);
    try {
      const bytes = await readFileBytes(file);
      const result = await analyzeFile(bytes);
      await saveLease({ name: file.name, doc: result.doc, findings: result.findings });
      await refreshLibrary();
      setStatus({ kind: 'analyzed', fileName: file.name, result, bytes });
    } catch (err) {
      setStatus({ kind: 'error', message: friendlyError(err) });
    }
  }

  async function onOpenLibrary(id: string): Promise<void> {
    const record = await getLease(id);
    if (!record) return;
    setSelected(null);
    setStatus({
      kind: 'analyzed',
      fileName: record.name,
      result: { doc: record.doc, findings: record.findings },
      bytes: null,
    });
  }

  async function onDeleteLibrary(id: string): Promise<void> {
    await deleteLease(id);
    await refreshLibrary();
  }

  async function onCompare(aId: string, bId: string): Promise<void> {
    const [a, b] = await Promise.all([getLease(aId), getLease(bId)]);
    if (!a || !b) return;
    setComparison({ a, b });
  }

  async function onClearAll(): Promise<void> {
    if (!window.confirm('Delete all saved leases from this device? This cannot be undone.')) return;
    await clearAll();
    await refreshLibrary();
    setStatus({ kind: 'idle' });
    setSelected(null);
  }

  function onExportJson(): void {
    if (status.kind !== 'analyzed') return;
    const json = exportFindingsJson({
      name: status.fileName,
      doc: status.result.doc,
      findings: status.result.findings,
    });
    downloadBlob(
      json,
      'application/json',
      `${status.fileName.replace(/\.pdf$/i, '')}-findings.json`,
    );
  }

  function onExportHtml(): void {
    if (status.kind !== 'analyzed') return;
    const html = exportFindingsHtml({
      name: status.fileName,
      doc: status.result.doc,
      findings: status.result.findings,
    });
    downloadBlob(
      html,
      'text/html',
      `${status.fileName.replace(/\.pdf$/i, '')}-findings.html`,
    );
  }

  return (
    <main>
      <header>
        <h1>LeaseGuard</h1>
        <p>Private, local-first lease analyzer. Nothing leaves your device.</p>
        <details className="privacy">
          <summary>Privacy &amp; how this works</summary>
          <ul>
            <li>The PDF is parsed entirely in your browser via pdf.js.</li>
            <li>All storage is in IndexedDB on this device. No account, no sync.</li>
            <li>
              A strict Content-Security-Policy (<code>default-src &apos;self&apos;</code>)
              blocks this page from loading scripts, fonts, or data from any other
              origin.
            </li>
            <li>
              LeaseGuard is not legal advice. Findings are heuristic pattern matches.
            </li>
          </ul>
        </details>
        <label>
          <span className="visually-hidden">Upload lease</span>
          <input
            type="file"
            accept="application/pdf"
            aria-label="upload lease"
            onChange={onFileChange}
          />
        </label>
      </header>

      {status.kind === 'loading' && (
        <p role="status" aria-live="polite">
          Analyzing {status.fileName}…
        </p>
      )}

      {status.kind === 'error' && (
        <p role="alert">Could not analyze this file: {status.message}</p>
      )}

      {status.kind === 'analyzed' && (
        <div className="results">
          <div className="results-actions">
            <button type="button" onClick={onExportJson}>
              Export findings (JSON)
            </button>
            <button type="button" onClick={onExportHtml}>
              Export findings (printable HTML)
            </button>
          </div>
          {(() => {
            const ocr = needsOcr(status.result.doc);
            if (!ocr.likelyScanned) return null;
            return (
              <p role="status" className="ocr-banner">
                This PDF looks scanned (avg {Math.round(ocr.avgCharsPerPage)} chars/page).
                Text extraction may be incomplete; OCR support is not enabled in this build.
              </p>
            );
          })()}
          <div className="split">
            <FindingsPanel
              findings={status.result.findings}
              onSelect={(f) => {
                setSelected(f);
                setSelectedPage(f.page);
              }}
            />
            <PdfViewer
              bytes={status.bytes}
              pageCount={status.result.doc.pages.length}
              selectedPage={selectedPage}
            />
          </div>
          {selected && (
            <article aria-label="selected finding">
              <h3>{selected.title}</h3>
              <p>{selected.explanation}</p>
              <blockquote>{selected.snippet}</blockquote>
              <small>Page {selected.page}</small>
            </article>
          )}
        </div>
      )}

      <LibraryPanel
        leases={library}
        onOpen={(id) => {
          void onOpenLibrary(id);
        }}
        onDelete={(id) => {
          void onDeleteLibrary(id);
        }}
      />

      <LibraryCompareForm
        leases={library}
        onCompare={(a, b) => {
          void onCompare(a, b);
        }}
      />

      {comparison && (
        <ComparePanel
          aName={comparison.a.name}
          bName={comparison.b.name}
          aFindings={comparison.a.findings}
          bFindings={comparison.b.findings}
        />
      )}

      <footer>
        <button type="button" onClick={() => void onClearAll()}>
          Clear all saved data
        </button>
      </footer>
    </main>
  );
}

function friendlyError(err: unknown): string {
  if (err instanceof PasswordProtectedPdfError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve(new Uint8Array(result));
      else reject(new Error('unexpected FileReader result'));
    };
    reader.onerror = (): void => reject(reader.error ?? new Error('file read failed'));
    reader.readAsArrayBuffer(file);
  });
}

function downloadBlob(content: string, mime: string, filename: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
