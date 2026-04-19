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

export function diagnosticsReport(): string {
  const payload = {
    schema: 'leaseguard.diagnostics.v1',
    generatedAt: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
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
