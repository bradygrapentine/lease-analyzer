import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { usePipeline } from './App/usePipeline';
import { FindingsPanel } from './ui/FindingsPanel';
import { LibraryPanel } from './ui/LibraryPanel';
import { PdfViewer } from './ui/PdfViewer';
import { ComparePanel } from './ui/ComparePanel';
import { LibraryCompareForm } from './ui/LibraryCompareForm';
import { TemplatesPanel } from './ui/TemplatesPanel';
import { TemplateMatchesPanel } from './ui/TemplateMatchesPanel';
import { LeaseFactsPanel } from './ui/LeaseFactsPanel';
import { extractLeaseFacts } from './facts/extractFacts';
import { WorkflowPanel } from './ui/WorkflowPanel';
import { buildIcs, type IcsDateInput } from './workflow/buildIcs';
import { buildSummary, copyToClipboard } from './workflow/copySummary';
import { buildHandoffZip } from './workflow/buildHandoffZip';
import type { LeaseFacts } from './facts/types';
import { PackManagerPanel } from './ui/PackManagerPanel';
import {
  deleteInstalledPack,
  listInstalledPacks,
  saveInstalledPack,
  setPackEnabled,
  getPackEnabled,
} from './rules/packStorage';
import { validatePackFile, type RulePackFile } from './rules/packSchema';
import { resolveActiveRules } from './rules/activePack';
import { RULE_PACK_V1 } from './rules/packV1';
import { SigningKeyPanel } from './ui/SigningKeyPanel';
import { createSigningKey, exportPublicKey } from './security/signingKeys';
import { signExport } from './storage/exportReport';
import { sha256Hex } from './security/inputHash';
import { AnnotationsPanel } from './ui/AnnotationsPanel';
import {
  deleteAnnotation,
  listAnnotations,
  saveAnnotation,
  updateAnnotation,
  type Annotation,
} from './annotations/annotations';
import { CounterOfferPanel } from './ui/CounterOfferPanel';
import {
  deleteCounterOffer,
  listCounterOffers,
  saveCounterOffer,
  type CounterOffer,
} from './negotiation/counterOffers';
import { needsOcr } from './compare/needsOcr';
import { PasswordProtectedPdfError } from './parser/types';
import type { Finding } from './rules/types';
import type { ClauseTemplate } from './templates/types';
import { matchTemplates } from './templates/matchTemplates';
import {
  saveTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
} from './storage/templates';
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

export function App(): JSX.Element {
  const [selected, setSelected] = useState<Finding | null>(null);
  const [library, setLibrary] = useState<LeaseMetadata[]>([]);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [standardId, setStandardIdState] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ClauseTemplate[]>([]);
  const [installedPacks, setInstalledPacks] = useState<RulePackFile[]>([]);
  const [enabledPacks, setEnabledPacks] = useState<Set<string>>(new Set());
  const [signingPublicKey, setSigningPublicKey] = useState<string | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [counterOffers, setCounterOffers] = useState<CounterOffer[]>([]);

  const refreshAnnotations = useCallback(async (leaseId: string) => {
    setAnnotations(await listAnnotations(leaseId));
  }, []);

  const refreshCounterOffers = useCallback(async () => {
    setCounterOffers(await listCounterOffers());
  }, []);

  const refreshSigningKey = useCallback(async () => {
    setSigningPublicKey(await exportPublicKey());
  }, []);

  const refreshPacks = useCallback(async () => {
    const packs = await listInstalledPacks();
    const enabled = new Set<string>();
    for (const p of packs) {
      if (await getPackEnabled(p.id)) enabled.add(p.id);
    }
    setInstalledPacks(packs);
    setEnabledPacks(enabled);
  }, []);

  const refreshLibrary = useCallback(async () => {
    const [leases, std] = await Promise.all([listLeases(), getStandardId()]);
    setLibrary(leases);
    setStandardIdState(std ?? null);
  }, []);

  const refreshTemplates = useCallback(async () => {
    setTemplates(await listTemplates());
  }, []);

  const activeRules = resolveActiveRules(RULE_PACK_V1, installedPacks, enabledPacks).rules;
  const pipeline = usePipeline({ onLibraryChange: refreshLibrary, rules: activeRules });
  const { status, ocrState, comparison } = pipeline;

  useEffect(() => {
    void refreshLibrary();
    void refreshTemplates();
    void refreshPacks();
    void refreshSigningKey();
    void refreshCounterOffers();
  }, [
    refreshLibrary,
    refreshTemplates,
    refreshPacks,
    refreshSigningKey,
    refreshCounterOffers,
  ]);

  // Load annotations whenever the currently-analyzed lease changes.
  const analyzedLeaseId =
    status.kind === 'analyzed' ? status.leaseId : null;
  useEffect(() => {
    if (analyzedLeaseId) {
      void refreshAnnotations(analyzedLeaseId);
    } else {
      setAnnotations([]);
    }
  }, [analyzedLeaseId, refreshAnnotations]);

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
    setSelected(null);
    await pipeline.upload(bytes, fileName);
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
      pipeline.setError(friendlyError(err));
    }
  }

  async function onOpenLibrary(id: string): Promise<void> {
    const record = await getLease(id);
    if (!record) return;
    setSelected(null);
    pipeline.open(record);
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
    pipeline.setComparison({ a, b });
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
      pipeline.reset();
      setSelected(null);
    } catch (err) {
      const msg =
        err instanceof WrongPassphraseError
          ? err.message
          : `Import failed: ${friendlyError(err)}`;
      pipeline.setError(msg);
    }
  }

  async function onClearAll(): Promise<void> {
    if (!window.confirm('Delete all saved leases from this device? This cannot be undone.')) return;
    await clearAll();
    await refreshLibrary();
    await refreshTemplates();
    pipeline.reset();
    setSelected(null);
  }

  async function onSaveTemplate(input: { name: string; text: string }): Promise<void> {
    await saveTemplate(input);
    await refreshTemplates();
  }

  async function onUpdateTemplate(id: string, patch: { name?: string; text?: string }): Promise<void> {
    await updateTemplate(id, patch);
    await refreshTemplates();
  }

  async function onDeleteTemplate(id: string): Promise<void> {
    await deleteTemplate(id);
    await refreshTemplates();
  }

  async function onSaveAnnotation(text: string): Promise<void> {
    if (!analyzedLeaseId || selected === null) return;
    await saveAnnotation({
      leaseId: analyzedLeaseId,
      paragraphIndex: selected.paragraphIndex,
      text,
    });
    await refreshAnnotations(analyzedLeaseId);
  }

  async function onUpdateAnnotation(id: string, text: string): Promise<void> {
    await updateAnnotation(id, text);
    if (analyzedLeaseId) await refreshAnnotations(analyzedLeaseId);
  }

  async function onDeleteAnnotation(id: string): Promise<void> {
    await deleteAnnotation(id);
    if (analyzedLeaseId) await refreshAnnotations(analyzedLeaseId);
  }

  async function onSaveCounterOffer(
    ruleId: string,
    name: string,
    text: string,
  ): Promise<void> {
    await saveCounterOffer({ ruleId, name, text });
    await refreshCounterOffers();
  }

  async function onDeleteCounterOffer(id: string): Promise<void> {
    await deleteCounterOffer(id);
    await refreshCounterOffers();
  }

  async function onCreateSigningKey(passphrase: string): Promise<void> {
    await createSigningKey(passphrase);
    await refreshSigningKey();
  }

  async function onExportSigningPublicKey(publicKey: string): Promise<void> {
    // Copy base64 public key to the clipboard. Fall back silently (CSP-friendly).
    try {
      const nav = globalThis.navigator as
        | { clipboard?: { writeText?: (s: string) => Promise<void> } }
        | undefined;
      await nav?.clipboard?.writeText?.(publicKey);
    } catch {
      // swallow — exporting is best-effort
    }
  }

  async function onExportSignedJson(): Promise<void> {
    if (status.kind !== 'analyzed') return;
    const passphrase = window.prompt('Passphrase to unlock the signing key:');
    if (!passphrase) return;
    try {
      const inputHash = status.bytes ? await sha256Hex(status.bytes) : null;
      const unsigned = exportFindingsJson({
        name: status.fileName,
        doc: status.result.doc,
        findings: status.result.findings,
        inputHash,
      });
      const signed = await signExport(unsigned, passphrase);
      downloadBlob(
        signed,
        'application/json',
        `${status.fileName.replace(/\.pdf$/i, '')}-findings.signed.json`,
      );
    } catch (err) {
      pipeline.setError(`Signing failed: ${friendlyError(err)}`);
    }
  }

  async function onImportPack(file: File): Promise<void> {
    const text = await file.text();
    const parsed: unknown = JSON.parse(text);
    const result = validatePackFile(parsed);
    if (!result.ok) {
      throw new Error(`Invalid pack: ${result.errors.join('; ')}`);
    }
    await saveInstalledPack(result.pack);
    await setPackEnabled(result.pack.id, true);
    await refreshPacks();
  }

  async function onTogglePack(id: string, enabled: boolean): Promise<void> {
    await setPackEnabled(id, enabled);
    await refreshPacks();
  }

  async function onDeletePack(id: string): Promise<void> {
    await deleteInstalledPack(id);
    await refreshPacks();
  }

  async function onAttemptOcr(): Promise<void> {
    setSelected(null);
    await pipeline.ocr();
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

  function onBuildIcs(): void {
    if (status.kind !== 'analyzed') return;
    const facts = extractLeaseFacts(status.result.doc);
    const dates = leaseFactsToIcsDates(facts);
    if (dates.length === 0) {
      // Nothing date-shaped to emit — surface via status so the user sees why.
      pipeline.setError('No dates found in this lease to export to .ics.');
      return;
    }
    const ics = buildIcs({ leaseName: status.fileName, dates });
    downloadBlobBytes(
      new TextEncoder().encode(ics),
      'text/calendar',
      `${status.fileName.replace(/\.pdf$/i, '')}.ics`,
    );
  }

  async function onCopySummary(): Promise<void> {
    if (status.kind !== 'analyzed') return;
    const summary = buildSummary({
      leaseName: status.fileName,
      findings: status.result.findings,
    });
    await copyToClipboard(summary);
  }

  function onDownloadHandoff(): void {
    if (status.kind !== 'analyzed') return;
    const pdfBytes = status.bytes ?? new Uint8Array();
    const findingsJson = exportFindingsJson({
      name: status.fileName,
      doc: status.result.doc,
      findings: status.result.findings,
    });
    const findingsHtml = exportFindingsHtml({
      name: status.fileName,
      doc: status.result.doc,
      findings: status.result.findings,
    });
    const readme =
      `LeaseGuard handoff for ${status.fileName}\n\n` +
      `- lease.pdf: original PDF (may be empty if opened from the library).\n` +
      `- findings.html: printable findings report.\n` +
      `- findings.json: machine-readable findings (schema leaseguard.findings.v1).\n`;
    const zip = buildHandoffZip({ pdfBytes, findingsHtml, findingsJson, readme });
    downloadBlobBytes(zip, 'application/zip', `${status.fileName.replace(/\.pdf$/i, '')}-handoff.zip`);
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
            {signingPublicKey !== null && (
              <button type="button" onClick={() => void onExportSignedJson()}>
                Export findings (signed JSON)
              </button>
            )}
          </div>
          {(() => {
            const ocr = needsOcr(status.result.doc);
            if (!ocr.likelyScanned) return null;
            return (
              <div role="status" className="ocr-banner">
                <p>
                  This PDF looks scanned (avg {Math.round(ocr.avgCharsPerPage)} chars/page).
                  Text extraction may be incomplete.
                </p>
                {status.bytes && ocrState.kind !== 'running' && (
                  <button type="button" onClick={() => void onAttemptOcr()}>
                    Attempt OCR
                  </button>
                )}
                {ocrState.kind === 'running' && (
                  <p aria-live="polite" className="ocr-progress">
                    Running OCR: {ocrState.stage} ({Math.round(ocrState.pct * 100)}%)
                  </p>
                )}
                {ocrState.kind === 'error' && (
                  <p role="alert">OCR failed: {ocrState.message}</p>
                )}
              </div>
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
              pages={status.result.doc.pages}
              highlight={
                selected ? (status.result.doc.paragraphs[selected.paragraphIndex]?.bbox ?? null) : null
              }
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
          <AnnotationsPanel
            leaseId={analyzedLeaseId ?? ''}
            paragraphIndex={selected ? selected.paragraphIndex : null}
            annotations={annotations}
            onSave={(text) => {
              void onSaveAnnotation(text);
            }}
            onUpdate={(id, text) => {
              void onUpdateAnnotation(id, text);
            }}
            onDelete={(id) => {
              void onDeleteAnnotation(id);
            }}
          />
          <CounterOfferPanel
            finding={selected}
            counters={counterOffers}
            onSave={(ruleId, name, text) => {
              void onSaveCounterOffer(ruleId, name, text);
            }}
            onDelete={(id) => {
              void onDeleteCounterOffer(id);
            }}
          />
          <TemplateMatchesPanel matches={matchTemplates(templates, status.result.doc)} />
          <LeaseFactsPanel facts={extractLeaseFacts(status.result.doc)} />
          <WorkflowPanel
            leaseName={status.fileName}
            findings={status.result.findings}
            onBuildIcs={onBuildIcs}
            onCopySummary={onCopySummary}
            onDownloadHandoff={onDownloadHandoff}
          />
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

      <TemplatesPanel
        templates={templates}
        onSave={(input) => {
          void onSaveTemplate(input);
        }}
        onUpdate={(id, patch) => {
          void onUpdateTemplate(id, patch);
        }}
        onDelete={(id) => {
          void onDeleteTemplate(id);
        }}
      />

      <PackManagerPanel
        builtInName="Built-in rules (v1)"
        installed={installedPacks}
        enabled={enabledPacks}
        onImport={onImportPack}
        onToggle={(id, enabled) => {
          void onTogglePack(id, enabled);
        }}
        onDelete={(id) => {
          void onDeletePack(id);
        }}
      />

      <SigningKeyPanel
        state={{ publicKey: signingPublicKey }}
        onCreateKey={(pp) => {
          void onCreateSigningKey(pp);
        }}
        onExportPublicKey={(pk) => {
          void onExportSigningPublicKey(pk);
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
  triggerDownload(blob, filename);
}

function downloadBlobBytes(bytes: Uint8Array, mime: string, filename: string): void {
  const blob = new Blob([bytes as BlobPart], { type: mime });
  triggerDownload(blob, filename);
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

/**
 * Adapter from Phase 8 `LeaseFacts` to the date-shape `buildIcs` expects.
 * We surface commencement + expiration + a 30-day-out notice reminder when
 * the lease specifies a notice period. Skip anything we can't ISO-format.
 */
function leaseFactsToIcsDates(facts: LeaseFacts): IcsDateInput[] {
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
