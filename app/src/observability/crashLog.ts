export const CRASH_LOG_CAPACITY = 20;

export interface CrashEntry {
  timestamp: number;
  message: string;
  stack: string | null;
  componentStack: string | null;
}

let entries: CrashEntry[] = [];

export function recordCrash(err: unknown, componentStack?: string): void {
  const entry: CrashEntry = {
    timestamp: Date.now(),
    message: messageOf(err),
    stack: err instanceof Error ? err.stack ?? null : null,
    componentStack: componentStack ?? null,
  };
  entries.unshift(entry);
  if (entries.length > CRASH_LOG_CAPACITY) {
    entries = entries.slice(0, CRASH_LOG_CAPACITY);
  }
}

export function snapshotCrashLog(): CrashEntry[] {
  return [...entries];
}

export function clearCrashLog(): void {
  entries = [];
}

/**
 * Human-readable enumeration of every category included in the diagnostics
 * payload. Exported so the UI can surface "what's in this file" above the
 * download button (Wave 11 Part D — risk register: crash-log privacy review).
 *
 * Keep in sync with the payload built by `diagnosticsReport`.
 */
export function diagnosticsSummary(): string[] {
  return [
    'userAgent',
    `stack-traces (last ${CRASH_LOG_CAPACITY})`,
    'rule-pack versions',
    'no PDF bytes',
    'no IDB contents',
  ];
}

export function diagnosticsReport(): string {
  const payload = {
    schema: 'leaseguard.diagnostics.v1',
    generatedAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    summary: diagnosticsSummary(),
    crashes: snapshotCrashLog(),
  };
  return JSON.stringify(payload, null, 2);
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
