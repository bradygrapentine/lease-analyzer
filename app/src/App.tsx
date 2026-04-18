import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { analyzeFile, type AnalysisResult } from './ui/analyzeFile';
import { FindingsPanel } from './ui/FindingsPanel';
import { PasswordProtectedPdfError } from './parser/types';
import type { Finding } from './rules/types';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading'; fileName: string }
  | { kind: 'analyzed'; fileName: string; result: AnalysisResult }
  | { kind: 'error'; message: string };

export function App(): JSX.Element {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [selected, setSelected] = useState<Finding | null>(null);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus({ kind: 'loading', fileName: file.name });
    setSelected(null);
    try {
      const bytes = await readFileBytes(file);
      const result = await analyzeFile(bytes);
      setStatus({ kind: 'analyzed', fileName: file.name, result });
    } catch (err) {
      setStatus({ kind: 'error', message: friendlyError(err) });
    }
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
