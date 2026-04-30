import { useEffect, useState } from 'react';

// Aria/data inventory:
//   role="status" + aria-live="polite" (announces stage transitions)
//
// Wave 51-B — staged loader ticker. Adopted from the Claude Design
// handoff (`app-shell.jsx > LoadingView`).
//
// usePipeline doesn't currently emit fine-grained sub-stages — it
// transitions `idle -> loading -> analyzed` as a single step, with
// the heavy lifting inside the worker. The ticker animates a fixed
// 5-step narrative client-side as a perception-management device,
// and the parent unmounts this component the moment the pipeline
// resolves to `analyzed`. Tests can pass `intervalMs={0}` to disable
// the timer for deterministic snapshots.

interface LoadingViewProps {
  fileName: string;
  intervalMs?: number;
}

const STAGES = [
  'Reading PDF in worker…',
  'Reconstructing paragraphs…',
  'Resolving defined terms…',
  'Running rules pack…',
  'Building the margin notes…',
] as const;

export function LoadingView({ fileName, intervalMs = 480 }: LoadingViewProps): JSX.Element {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (intervalMs <= 0) return;
    let cancelled = false;
    let i = 0;
    function tick(): void {
      if (cancelled) return;
      i++;
      if (i >= STAGES.length) return;
      setStage(i);
      timer = setTimeout(tick, intervalMs);
    }
    let timer = setTimeout(tick, intervalMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [intervalMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="max-w-[520px] mx-auto px-6 py-24 flex flex-col gap-4"
    >
      <p className="font-sans text-small uppercase tracking-wide text-fg-muted">Analyzing</p>
      <p className="font-display text-fg leading-snug text-[1.4rem]">{fileName}</p>
      <hr className="border-0 h-px bg-rule-subtle mt-1" />
      <ul className="list-none p-0 m-0 font-mono text-mono text-fg-muted">
        {STAGES.map((s, i) => (
          <li
            key={s}
            data-testid="loading-stage"
            data-stage={i < stage ? 'done' : i === stage ? 'active' : 'pending'}
            className={`py-1 flex gap-2.5 ${i <= stage ? 'text-fg-body' : 'text-fg-faint'}`}
          >
            <span
              aria-hidden="true"
              className={`w-3 inline-block ${
                i < stage ? 'text-positive' : i === stage ? 'text-ink' : 'text-fg-faint'
              }`}
            >
              {i < stage ? '✓' : i === stage ? '›' : '·'}
            </span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
