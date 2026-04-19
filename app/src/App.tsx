import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { analyzeFile, type AnalysisResult } from './ui/analyzeFile';
import { FindingsPanel } from './ui/FindingsPanel';
import { LibraryPanel } from './ui/LibraryPanel';
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

type Status =
  | { kind: 'idle' }
  | { kind: 'loading'; fileName: string }
  | { kind: 'analyzed'; fileName: string; result: AnalysisResult }
  | { kind: 'error'; message: string };

export function App(): JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [selected, setSelected] = useState<Finding | null>(null);
  const [library, setLibrary] = useState<LeaseMetadata[]>([]);

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
      setStatus({ kind: 'analyzed', fileName: file.name, result });
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
    });
  }

  async function onDeleteLibrary(id: string): Promise<void> {
    await deleteLease(id);
    await refreshLibrary();
  }

  async function onClearAll(): Promise<void> {
    if (!window.confirm('Delete all saved leases from this device? This cannot be undone.')) return;
    await clearAll();
    await refreshLibrary();
    setStatus({ kind: 'idle' });
    setSelected(null);
  }

  function onExport(): void {
    if (status.kind !== 'analyzed') return;
    const json = exportFindingsJson({
      name: status.fileName,
      doc: status.result.doc,
      findings: status.result.findings,
    });
    downloadJson(json, `${status.fileName.replace(/\.pdf$/i, '')}-findings.json`);
  }

  return (
    <main>
      <header>
        <h1>LeaseGuard</h1>
        <p>Private, local-first lease analyzer. Nothing leaves your device.</p>
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
            <button type="button" onClick={onExport}>
              Export findings (JSON)
            </button>
          </div>
          <FindingsPanel
            findings={status.result.findings}
            onSelect={(f) => setSelected(f)}
          />
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

function downloadJson(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
