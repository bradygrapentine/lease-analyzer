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
  clearStandardId,
  deleteLease,
  getLease,
  getStandardId,
  listAllLeaseRecords,
  listLeases,
  renameLease,
  replaceAllLeases,
  saveLease,
  setStandardId,
  type LeaseMetadata,
} from './storage/storage';
import {
  exportEncryptedArchive,
  importEncryptedArchive,
  WrongPassphraseError,
} from './storage/archive';
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
  const [standardId, setStandardIdState] = useState<string | null>(null);

  const refreshLibrary = useCallback(async () => {
    const [leases, std] = await Promise.all([listLeases(), getStandardId()]);
    setLibrary(leases);
    setStandardIdState(std ?? null);
  }, []);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      const inEditable =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);
      const isCmdF = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f';
      const isSlash = e.key === '/' && !inEditable;
      if (!isCmdF && !isSlash) return;
      const search = document.querySelector<HTMLInputElement>(
        'input[aria-label="search findings"]',
      );
      if (!search) return;
      e.preventDefault();
      search.focus();
      search.select();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function handleBytes(bytes: Uint8Array, fileName: string): Promise<void> {
    setStatus({ kind: 'loading', fileName });
    setSelected(null);
    setComparison(null);
    try {
      // pdf.js transfers ownership of the ArrayBuffer during parse, so we
      // hand it a copy and keep the original for the viewer.
      const result = await analyzeFile(new Uint8Array(bytes));
      const newId = await saveLease({
        name: fileName,
        doc: result.doc,
        findings: result.findings,
      });
      await refreshLibrary();
      setStatus({ kind: 'analyzed', fileName, result, bytes });

      // Auto-compare against the standard, if one exists and it isn't this lease.
      const std = await getStandardId();
      if (std && std !== newId) {
        const standard = await getLease(std);
        if (standard) {
          setComparison({
            a: standard,
            b: {
              id: newId,
              name: fileName,
              createdAt: Date.now(),
              updatedAt: Date.now(),
              rulePackVersion: result.findings[0]?.rulePackVersion ?? 'unknown',
              pageCount: result.doc.pages.length,
              findingCount: result.findings.length,
              doc: result.doc,
              findings: result.findings,
            },
          });
        }
      }
    } catch (err) {
      setStatus({ kind: 'error', message: friendlyError(err) });
    }
  }

  async function onFileChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    const bytes = await readFileBytes(file);
    await handleBytes(bytes, file.name);
  }

  async function onTrySample(): Promise<void> {
    try {
      const res = await fetch('/sample.pdf');
      if (!res.ok) throw new Error(`Could not load sample (${res.status})`);
      const buf = await res.arrayBuffer();
      await handleBytes(new Uint8Array(buf), 'Sample lease.pdf');
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
    if (standardId === id) await clearStandardId();
    await refreshLibrary();
  }

  async function onSetStandard(id: string): Promise<void> {
    await setStandardId(id);
    await refreshLibrary();
  }

  async function onRename(id: string, name: string): Promise<void> {
    await renameLease(id, name);
    await refreshLibrary();
  }

  async function onCompare(aId: string, bId: string): Promise<void> {
    const [a, b] = await Promise.all([getLease(aId), getLease(bId)]);
    if (!a || !b) return;
    setComparison({ a, b });
  }

  async function onExportArchive(): Promise<void> {
    const passphrase = window.prompt('Passphrase for the encrypted archive:');
    if (!passphrase) return;
    const [records, std] = await Promise.all([listAllLeaseRecords(), getStandardId()]);
    const bytes = await exportEncryptedArchive(records, std ?? null, passphrase);
    const blob = new Blob([bytes as BlobPart], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leaseguard-${new Date().toISOString().slice(0, 10)}.lgarchive`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function onImportArchiveFile(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const passphrase = window.prompt('Passphrase for this archive:');
    if (!passphrase) return;
    try {
      const bytes = await readFileBytes(file);
      const payload = await importEncryptedArchive(bytes, passphrase);
      if (
        !window.confirm(
          `Replace current library with ${payload.leases.length} lease(s) from this archive?`,
        )
      ) {
        return;
      }
      await replaceAllLeases(payload.leases, payload.standardId);
      await refreshLibrary();
      setStatus({ kind: 'idle' });
      setSelected(null);
      setComparison(null);
    } catch (err) {
      const msg =
        err instanceof WrongPassphraseError
          ? err.message
          : `Import failed: ${friendlyError(err)}`;
      setStatus({ kind: 'error', message: msg });
    }
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
        <button type="button" onClick={() => void onTrySample()}>
          Try a sample lease
        </button>
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
        standardId={standardId}
        onOpen={(id) => {
          void onOpenLibrary(id);
        }}
        onDelete={(id) => {
          void onDeleteLibrary(id);
        }}
        onSetStandard={(id) => {
          void onSetStandard(id);
        }}
        onRename={(id, name) => {
          void onRename(id, name);
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
        <button type="button" onClick={() => void onExportArchive()}>
          Export encrypted archive
        </button>
        <label>
          <span className="visually-hidden">Import encrypted archive</span>
          Import encrypted archive:
          <input
            type="file"
            accept=".lgarchive,application/octet-stream"
            aria-label="import encrypted archive"
            onChange={(e) => void onImportArchiveFile(e)}
          />
        </label>
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
