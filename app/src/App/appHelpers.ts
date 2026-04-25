import { PasswordProtectedPdfError } from '../parser/types';
import type { LeaseFacts } from '../facts/types';
import type { IcsDateInput } from '../workflow/buildIcs';
import { buildIcs } from '../workflow/buildIcs';
import { extractLeaseFacts } from '../facts/extractFacts';
import { buildHandoffZip } from '../workflow/buildHandoffZip';
import { exportFindingsHtml } from '../storage/exportHtml';
import { exportFindingsJson } from '../storage/exportReport';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';
import {
  clearAll,
  getStandardId,
  listAllLeaseRecords,
  replaceAllLeases,
  type LeaseRecord,
} from '../storage/storage';
import {
  exportEncryptedArchive,
  importEncryptedArchive,
  WrongPassphraseError,
} from '../storage/archive';

export function friendlyError(err: unknown): string {
  if (err instanceof PasswordProtectedPdfError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}

/** jsdom doesn't implement `File.arrayBuffer`; fall back to `FileReader`. */
export async function readFileBytes(file: File): Promise<Uint8Array> {
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

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadBlob(content: string, mime: string, filename: string): void {
  triggerDownload(new Blob([content], { type: mime }), filename);
}

export function downloadBlobBytes(
  bytes: Uint8Array,
  mime: string,
  filename: string,
): void {
  triggerDownload(new Blob([bytes as BlobPart], { type: mime }), filename);
}

export function stripPdfExt(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

/** Adapter from `LeaseFacts` to the date shape `buildIcs` expects. */
export function leaseFactsToIcsDates(facts: LeaseFacts): IcsDateInput[] {
  const out: IcsDateInput[] = [];
  if (facts.commencementDate) {
    out.push({ summary: 'Lease commences', date: facts.commencementDate });
  }
  if (facts.expirationDate) {
    out.push({ summary: 'Lease expires', date: facts.expirationDate });
  }
  if (facts.expirationDate && facts.noticePeriodDays) {
    const notice = subtractDaysIso(facts.expirationDate, facts.noticePeriodDays);
    if (notice) {
      out.push({
        summary: `Notice deadline (${facts.noticePeriodDays} days before expiration)`,
        date: notice,
      });
    }
  }
  return out;
}

export interface AnalyzedExportInput {
  fileName: string;
  doc: LeaseDocument;
  findings: Finding[];
  bytes?: Uint8Array | null;
}

/** Trigger a JSON export download for the current analysis. */
export function exportFindingsAsJson(input: AnalyzedExportInput): void {
  downloadBlob(
    exportFindingsJson({
      name: input.fileName,
      doc: input.doc,
      findings: input.findings,
    }),
    'application/json',
    `${stripPdfExt(input.fileName)}-findings.json`,
  );
}

/** Trigger a printable-HTML export download for the current analysis. */
export function exportFindingsAsHtml(input: AnalyzedExportInput): void {
  downloadBlob(
    exportFindingsHtml({
      name: input.fileName,
      doc: input.doc,
      findings: input.findings,
    }),
    'text/html',
    `${stripPdfExt(input.fileName)}-findings.html`,
  );
}

/**
 * Build an .ics calendar export for the lease's commencement / expiration /
 * notice deadline. Returns null if the lease has no extractable dates so the
 * caller can surface a friendly message.
 */
export function buildIcsBytes(input: {
  fileName: string;
  doc: LeaseDocument;
}): { bytes: Uint8Array; filename: string } | null {
  const dates = leaseFactsToIcsDates(extractLeaseFacts(input.doc));
  if (dates.length === 0) return null;
  return {
    bytes: new TextEncoder().encode(
      buildIcs({ leaseName: input.fileName, dates }),
    ),
    filename: `${stripPdfExt(input.fileName)}.ics`,
  };
}

/** Build the handoff zip (PDF + findings + readme) and trigger a download. */
export function downloadHandoffZip(input: AnalyzedExportInput): void {
  const findingsJson = exportFindingsJson({
    name: input.fileName,
    doc: input.doc,
    findings: input.findings,
  });
  const findingsHtml = exportFindingsHtml({
    name: input.fileName,
    doc: input.doc,
    findings: input.findings,
  });
  const readme =
    `LeaseGuard handoff for ${input.fileName}\n\n` +
    `- lease.pdf: original PDF (may be empty if opened from the library).\n` +
    `- findings.html: printable findings report.\n` +
    `- findings.json: machine-readable findings (schema leaseguard.findings.v1).\n`;
  const zip = buildHandoffZip({
    pdfBytes: input.bytes ?? new Uint8Array(),
    findingsHtml,
    findingsJson,
    readme,
  });
  downloadBlobBytes(zip, 'application/zip', `${stripPdfExt(input.fileName)}-handoff.zip`);
}

/**
 * Prompt for a passphrase, build an encrypted archive of every saved lease
 * (plus the standard-id pointer), and trigger a download. No-op if the user
 * cancels the prompt.
 */
export async function exportEncryptedArchiveFlow(): Promise<void> {
  const passphrase = window.prompt('Passphrase for the encrypted archive:');
  if (!passphrase) return;
  const [records, std] = await Promise.all([listAllLeaseRecords(), getStandardId()]);
  const bytes = await exportEncryptedArchive(records, std ?? null, passphrase);
  downloadBlobBytes(
    bytes,
    'application/octet-stream',
    `leaseguard-${new Date().toISOString().slice(0, 10)}.lgarchive`,
  );
}

export interface ImportArchiveCallbacks {
  onSuccess: (leases: LeaseRecord[]) => void | Promise<void>;
  onError: (message: string) => void;
}

/**
 * Decrypt + replace the entire library from an `.lgarchive` file. Confirms
 * with the user before destructive replace. Errors flow through `onError`
 * rather than being thrown, since this is a UI-driven flow.
 */
export async function importEncryptedArchiveFlow(
  file: File,
  cb: ImportArchiveCallbacks,
): Promise<void> {
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
    await cb.onSuccess(payload.leases);
  } catch (err) {
    cb.onError(
      err instanceof WrongPassphraseError
        ? err.message
        : `Import failed: ${friendlyError(err)}`,
    );
  }
}

/**
 * Confirm + nuke every saved lease and template. The two refresh callbacks
 * exist so the caller can collapse its in-memory mirrors without us reaching
 * back into React state from a pure helper.
 */
export async function clearAllFlow(callbacks: {
  onCleared: () => void | Promise<void>;
}): Promise<boolean> {
  if (!window.confirm('Delete all saved leases from this device? This cannot be undone.')) {
    return false;
  }
  await clearAll();
  await callbacks.onCleared();
  return true;
}

function subtractDaysIso(iso: string, days: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  const t = Date.UTC(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(t)) return null;
  const shifted = new Date(t - days * 86_400_000);
  const yy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
