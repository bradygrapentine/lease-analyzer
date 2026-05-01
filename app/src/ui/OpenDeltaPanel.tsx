import { useState } from 'react';
import { Badge } from './system/Badge';
import { StatusMessage } from './primitives/StatusMessage';

interface OpenDeltaPanelProps {
  onPreview: (
    bytes: Uint8Array,
  ) => Promise<{ ok: true; preview: string } | { ok: false; reason: string }>;
  onApply: () => Promise<void>;
}

type PreviewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; preview: string }
  | { kind: 'error'; reason: string };

export function OpenDeltaPanel({ onPreview, onApply }: OpenDeltaPanelProps): JSX.Element {
  const [state, setState] = useState<PreviewState>({ kind: 'idle' });
  const [applying, setApplying] = useState(false);

  async function readBytes(file: File): Promise<Uint8Array> {
    // jsdom doesn't implement File.arrayBuffer(); fall back to FileReader.
    if (typeof file.arrayBuffer === 'function') {
      return new Uint8Array(await file.arrayBuffer());
    }
    return await new Promise<Uint8Array>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = (): void => {
        const r = fr.result;
        if (r instanceof ArrayBuffer) resolve(new Uint8Array(r));
        else reject(new Error('FileReader returned non-ArrayBuffer'));
      };
      fr.onerror = (): void => reject(fr.error ?? new Error('FileReader failed'));
      fr.readAsArrayBuffer(file);
    });
  }

  async function handleFile(file: File): Promise<void> {
    setState({ kind: 'loading' });
    try {
      const bytes = await readBytes(file);
      const result = await onPreview(bytes);
      if (result.ok) {
        setState({ kind: 'ready', preview: result.preview });
      } else {
        setState({ kind: 'error', reason: result.reason });
      }
    } catch (err) {
      setState({ kind: 'error', reason: err instanceof Error ? err.message : String(err) });
    }
  }

  async function handleApply(): Promise<void> {
    setApplying(true);
    try {
      await onApply();
    } finally {
      setApplying(false);
    }
  }

  return (
    <section>
      <h2>Open shared patch</h2>
      <div>
        <label htmlFor="open-delta-file">Delta file (.lgdelta)</label>
        <input
          id="open-delta-file"
          type="file"
          accept=".lgdelta"
          onChange={(e): void => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </div>
      {state.kind === 'loading' && <p>Verifying…</p>}
      {state.kind === 'error' && (
        <>
          <Badge variant="severity" severity="high">
            Verification failed
          </Badge>{' '}
          <StatusMessage tone="error">Verification failed: {state.reason}</StatusMessage>
        </>
      )}
      {state.kind === 'ready' && (
        <>
          <pre aria-label="Change preview">{state.preview}</pre>
          <button
            type="button"
            disabled={applying}
            onClick={(): void => {
              void handleApply();
            }}
          >
            {applying ? 'Applying…' : 'Accept and merge'}
          </button>
        </>
      )}
    </section>
  );
}
