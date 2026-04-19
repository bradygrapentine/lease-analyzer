/**
 * Minimal RFC 5545 VCALENDAR generator — no deps, all-day events only.
 *
 * Input is intentionally generic (not tied to Phase 8's `LeaseFacts`).
 * A later adapter will shape `LeaseFacts` into this input.
 */

export interface IcsDateInput {
  /** Human-readable title; will be escaped. */
  summary: string;
  /** ISO calendar date, YYYY-MM-DD. All-day event only. */
  date: string;
  /** Optional long-form body → DESCRIPTION. Escaped + folded. */
  notes?: string;
}

export interface IcsInput {
  leaseName: string;
  dates: IcsDateInput[];
  /** Override for deterministic tests. Defaults to `new Date()`. */
  now?: Date;
  /** Override UID entropy for deterministic tests. */
  uidSeed?: string;
}

const CRLF = '\r\n';
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function buildIcs(input: IcsInput): string {
  if (input.dates.length === 0) {
    throw new Error('buildIcs: needs at least one date');
  }
  const now = input.now ?? new Date();
  const dtstamp = formatDtstamp(now);
  const seed = input.uidSeed ?? randomSeed();

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LeaseGuard//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  input.dates.forEach((d, i) => {
    lines.push(...buildEvent(d, i, dtstamp, seed));
  });

  lines.push('END:VCALENDAR');

  // Fold every content line; envelope + continuations joined by CRLF.
  const folded = lines.flatMap(foldLine);
  return folded.join(CRLF) + CRLF;
}

function buildEvent(
  d: IcsDateInput,
  index: number,
  dtstamp: string,
  seed: string,
): string[] {
  const { start, end } = validateAndExpand(d.date);
  const out: string[] = [
    'BEGIN:VEVENT',
    `UID:${seed}-${index}@leaseguard.local`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeText(d.summary)}`,
  ];
  if (d.notes !== undefined && d.notes.length > 0) {
    out.push(`DESCRIPTION:${escapeText(d.notes)}`);
  }
  out.push('END:VEVENT');
  return out;
}

function validateAndExpand(date: string): { start: string; end: string } {
  const m = ISO_DATE.exec(date);
  if (!m) {
    throw new Error(`buildIcs: invalid date "${date}" (expected YYYY-MM-DD)`);
  }
  const [, y, mo, d] = m;
  const yn = Number(y);
  const mon = Number(mo);
  const dn = Number(d);
  // Sanity check: construct a Date and verify round-trip.
  const asDate = new Date(Date.UTC(yn, mon - 1, dn));
  if (
    asDate.getUTCFullYear() !== yn ||
    asDate.getUTCMonth() !== mon - 1 ||
    asDate.getUTCDate() !== dn
  ) {
    throw new Error(`buildIcs: invalid date "${date}" (expected YYYY-MM-DD)`);
  }
  const start = `${y}${mo}${d}`;
  // RFC 5545 3.8.2.2: all-day DTEND is exclusive — use next day.
  const next = new Date(asDate.getTime() + 86_400_000);
  const end =
    `${next.getUTCFullYear()}` +
    `${pad2(next.getUTCMonth() + 1)}` +
    `${pad2(next.getUTCDate())}`;
  return { start, end };
}

function formatDtstamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}` +
    `${pad2(d.getUTCMonth() + 1)}` +
    `${pad2(d.getUTCDate())}` +
    'T' +
    `${pad2(d.getUTCHours())}` +
    `${pad2(d.getUTCMinutes())}` +
    `${pad2(d.getUTCSeconds())}` +
    'Z'
  );
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** RFC 5545 3.3.11 text escaping. Order matters: backslash first. */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\n|\r/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

/**
 * RFC 5545 3.1: fold lines at 75 *octets*. Continuation lines start with
 * a single space. We measure bytes, not chars, so multi-byte UTF-8 never
 * splits mid-codepoint.
 */
function foldLine(line: string): string[] {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return [line];
  const out: string[] = [];
  let cursor = 0;
  let first = true;
  while (cursor < bytes.length) {
    // First line: up to 75 bytes. Continuation: up to 74 bytes (leading space eats 1).
    const budget = first ? 75 : 74;
    let end = Math.min(cursor + budget, bytes.length);
    // Don't split a UTF-8 codepoint. Back off until `end` is at a boundary.
    while (end > cursor && end < bytes.length && isUtf8Continuation(bytes[end])) {
      end--;
    }
    const chunk = new TextDecoder().decode(bytes.subarray(cursor, end));
    out.push(first ? chunk : ` ${chunk}`);
    cursor = end;
    first = false;
  }
  return out;
}

function isUtf8Continuation(b: number | undefined): boolean {
  return b !== undefined && (b & 0b1100_0000) === 0b1000_0000;
}

function randomSeed(): string {
  // 64 bits of entropy encoded as hex — plenty for UID uniqueness.
  const buf = new Uint8Array(8);
  (globalThis.crypto ?? cryptoFallback()).getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

function cryptoFallback(): { getRandomValues(a: Uint8Array): Uint8Array } {
  // jsdom always provides crypto; this branch is a defensive last resort.
  return {
    getRandomValues(a: Uint8Array) {
      for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
      return a;
    },
  };
}
