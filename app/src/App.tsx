import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { usePipeline } from './App/usePipeline';
import { useAnnotations } from './App/useAnnotations';
import { useCounterOffers } from './App/useCounterOffers';
import { useReanalyzeOnRulesChange } from './App/useReanalyzeOnRulesChange';
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
import { bulkImport, type BulkResult, type BulkSummary } from './workflow/bulkImport';
import type { LeaseFacts } from './facts/types';
import { PackManagerPanel } from './ui/PackManagerPanel';
import {
  deleteInstalledPack,
  listInstalledPacks,
  saveInstalledPack,
  setPackEnabled,
  getPackEnabled,
  getSelectedJurisdictions,
  setSelectedJurisdictions,
  getSeverityOverrides,
  setSeverityOverride,
} from './rules/packStorage';
import { validatePackFile, type RulePackFile } from './rules/packSchema';
import { resolveActiveRules } from './rules/activePack';
import { RULE_PACK_V1 } from './rules/packV1';
import { JURISDICTION_OPTIONS, filterByJurisdiction } from './rules/jurisdictions';
import { applySeverityOverrides } from './rules/severityOverrides';
import { diffPack, type PackDiff } from './rules/packDiff';
import { analyzeFile } from './ui/analyzeFile';
import { JurisdictionPickerPanel } from './ui/JurisdictionPickerPanel';
import { SeverityOverridesPanel } from './ui/SeverityOverridesPanel';
import { PackDiffPanel } from './ui/PackDiffPanel';
import { AuditLogPanel } from './ui/AuditLogPanel';
import { BulkImportPanel } from './ui/BulkImportPanel';
import {
  overrideToSeverity,
  overridesToPanel,
  severityToOverride as severityToOverrideSeverity,
} from './ui/severityMap';
import {
  appendAuditEntry,
  listAuditEntries,
  verifyAuditChain,
  type AuditEntry,
  type ChainVerification,
} from './audit/auditLog';
import { buildAuditLogJson, downloadAuditLogBlob } from './audit/auditExport';
import { SigningKeyPanel } from './ui/SigningKeyPanel';
import { createSigningKey, exportPublicKey } from './security/signingKeys';
import { signExport } from './storage/exportReport';
import { sha256Hex } from './security/inputHash';
import { AnnotationsPanel } from './ui/AnnotationsPanel';
// Annotation CRUD is owned by useAnnotations (see App/useAnnotations.ts).
import { CounterOfferPanel } from './ui/CounterOfferPanel';
// Counter-offer CRUD is owned by useCounterOffers (see App/useCounterOffers.ts).
import { PortfolioPanel } from './ui/PortfolioPanel';
import { CustomRuleBuilderPanel } from './ui/CustomRuleBuilderPanel';
import { RedlinePanel } from './ui/RedlinePanel';
import { VersionHistoryPanel } from './ui/VersionHistoryPanel';
import { SideLetterPanel } from './ui/SideLetterPanel';
import {
  saveEdit,
  listEditsForLease,
  deleteEdit,
} from './redline/redlineStorage';
import type { RedlineEdit } from './redline/redline';
import { buildRedlineHtml } from './redline/redline';
import {
  listVersionsForLease,
  saveVersion,
  getVersion,
  deleteVersion,
  type LeaseVersion,
} from './negotiation/versionHistory';
import { buildSideLetterHtml } from './negotiation/sideLetter';
import {
  getPackSignatureStatus,
  saveSignedPack,
  type PackSignatureStatus,
} from './rules/packStorage';
import { verifySignedPack } from './rules/packSigning';
import type { PackSignatureBadge } from './ui/PackManagerPanel';
import { needsOcr } from './compare/needsOcr';
import { PasswordProtectedPdfError } from './parser/types';
import type { Finding, Rule } from './rules/types';
import { RULE_PACK_SCHEMA_VERSION } from './rules/packSchema';
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

export function App(): JSX.Element {
  const [selected, setSelected] = useState<Finding | null>(null);
  const [library, setLibrary] = useState<LeaseMetadata[]>([]);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [standardId, setStandardIdState] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ClauseTemplate[]>([]);
  const [installedPacks, setInstalledPacks] = useState<RulePackFile[]>([]);
  const [enabledPacks, setEnabledPacks] = useState<Set<string>>(new Set());
  const [selectedJurisdictions, setSelectedJurisdictionsState] = useState<string[]>([]);
  const [severityOverrides, setSeverityOverridesState] = useState<
    Record<string, import('./rules/types').Severity>
  >({});
  const [packDiff, setPackDiff] = useState<PackDiff | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditVerification, setAuditVerification] = useState<ChainVerification | null>(null);
  const [signingPublicKey, setSigningPublicKey] = useState<string | null>(null);
  // annotations + counter offers extracted into dedicated hooks (Wave 7-D).
  // See src/App/useAnnotations.ts and src/App/useCounterOffers.ts.
  const [view, setView] = useState<'current' | 'portfolio' | 'redline'>('current');
  const [portfolioFindings, setPortfolioFindings] = useState<Map<string, Finding[]>>(
    new Map(),
  );
  const [redlineEdits, setRedlineEdits] = useState<RedlineEdit[]>([]);
  const [versions, setVersions] = useState<LeaseVersion[]>([]);
  const [sideLetterSigner, setSideLetterSigner] = useState<{ name: string; title: string }>(
    { name: '', title: '' },
  );
  const [packSignatureStatus, setPackSignatureStatus] = useState<
    Record<string, PackSignatureBadge>
  >({});

  const refreshPortfolioFindings = useCallback(async () => {
    const records = await listAllLeaseRecords();
    const map = new Map<string, Finding[]>();
    for (const r of records) map.set(r.id, r.findings);
    setPortfolioFindings(map);
  }, []);

  const refreshRedlineEdits = useCallback(async (leaseId: string) => {
    setRedlineEdits(await listEditsForLease(leaseId));
  }, []);

  const refreshVersions = useCallback(async (leaseId: string) => {
    setVersions(await listVersionsForLease(leaseId));
  }, []);

  const refreshSigningKey = useCallback(async () => {
    setSigningPublicKey(await exportPublicKey());
  }, []);

  const refreshPacks = useCallback(async () => {
    const packs = await listInstalledPacks();
    const enabled = new Set<string>();
    const sigStatus: Record<string, PackSignatureBadge> = {};
    for (const p of packs) {
      if (await getPackEnabled(p.id)) enabled.add(p.id);
      const status: PackSignatureStatus = await getPackSignatureStatus(p.id);
      // Map storage-layer "unsigned" to UI's "community" badge.
      sigStatus[p.id] =
        status === 'verified'
          ? 'verified'
          : status === 'invalid'
            ? 'invalid'
            : status === 'unknown'
              ? 'unknown'
              : 'community';
    }
    setInstalledPacks(packs);
    setEnabledPacks(enabled);
    setPackSignatureStatus(sigStatus);
  }, []);

  const refreshRulePackSettings = useCallback(async () => {
    const [j, ov] = await Promise.all([
      getSelectedJurisdictions(),
      getSeverityOverrides(),
    ]);
    setSelectedJurisdictionsState(j);
    setSeverityOverridesState(ov);
  }, []);

  const refreshAuditLog = useCallback(async () => {
    setAuditEntries(await listAuditEntries());
  }, []);

  const refreshLibrary = useCallback(async () => {
    const [leases, std] = await Promise.all([listLeases(), getStandardId()]);
    setLibrary(leases);
    setStandardIdState(std ?? null);
  }, []);

  const refreshTemplates = useCallback(async () => {
    setTemplates(await listTemplates());
  }, []);

  // Layered rule resolution:
  //   built-in + installed packs → filter by jurisdictions → apply severity
  //   overrides. Each step is pure; no IndexedDB inside the memo.
  const baseResolvedRules = resolveActiveRules(
    RULE_PACK_V1,
    installedPacks,
    enabledPacks,
  ).rules;
  const activeRules = useMemo(
    () =>
      applySeverityOverrides(
        filterByJurisdiction(baseResolvedRules, selectedJurisdictions),
        severityOverrides,
      ),
    [baseResolvedRules, selectedJurisdictions, severityOverrides],
  );
  const pipeline = usePipeline({ onLibraryChange: refreshLibrary, rules: activeRules });
  const { status, ocrState, comparison } = pipeline;

  const analyzedLeaseId =
    status.kind === 'analyzed' ? status.leaseId : null;
  const annotationsApi = useAnnotations(analyzedLeaseId);
  const counterOffersApi = useCounterOffers();
  const annotations = annotationsApi.annotations;
  const counterOffers = counterOffersApi.counterOffers;

  const plainEnglishByRuleId = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const r of activeRules) {
      if (r.plainEnglish) out[r.id] = r.plainEnglish;
    }
    return out;
  }, [activeRules]);

  const suggestedEditByRuleId = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const r of activeRules) {
      if (r.suggestedEdit) out[r.id] = r.suggestedEdit;
    }
    return out;
  }, [activeRules]);

  // For "Apply suggestion": prefer a user-authored counter-offer text over
  // the rule's built-in `suggestedEdit`. The hook already exposes the
  // latest-by-ruleId map so this just merges the two layers.
  const suggestedTextByRuleId = useMemo<Record<string, string>>(
    () => ({ ...suggestedEditByRuleId, ...counterOffersApi.latestTextByRuleId }),
    [suggestedEditByRuleId, counterOffersApi.latestTextByRuleId],
  );

  // All rule ids the custom-rule builder should treat as "taken", so the
  // dup-id guard fires against both the built-in pack and any installed pack.
  const existingRuleIds = useMemo<string[]>(() => {
    const ids = new Set<string>();
    for (const r of RULE_PACK_V1) ids.add(r.id);
    for (const pack of installedPacks) for (const r of pack.rules) ids.add(r.id);
    return Array.from(ids);
  }, [installedPacks]);

  useEffect(() => {
    void refreshLibrary();
    void refreshTemplates();
    void refreshPacks();
    void refreshSigningKey();
    void refreshRulePackSettings();
    void refreshAuditLog();
  }, [
    refreshLibrary,
    refreshTemplates,
    refreshPacks,
    refreshSigningKey,
    refreshRulePackSettings,
    refreshAuditLog,
  ]);

  // Re-index the portfolio whenever the library or the view changes.
  useEffect(() => {
    if (view === 'portfolio') {
      void refreshPortfolioFindings();
    }
  }, [view, library, refreshPortfolioFindings]);

  // Load lease-scoped data whenever the currently-analyzed lease changes.
  // Annotations are owned by useAnnotations() and load themselves.
  useEffect(() => {
    if (analyzedLeaseId) {
      void refreshRedlineEdits(analyzedLeaseId);
      void refreshVersions(analyzedLeaseId);
    } else {
      setRedlineEdits([]);
      setVersions([]);
    }
  }, [analyzedLeaseId, refreshRedlineEdits, refreshVersions]);

  // Auto-reanalyze when any rule-affecting input changes (Wave 7-D).
  // Replaces the three manual `pipeline.reanalyze()` call sites that were
  // previously easy to forget when adding new mutators.
  useReanalyzeOnRulesChange({
    statusKind: status.kind,
    reanalyze: pipeline.reanalyze,
    installedPacks,
    enabledPackIds: enabledPacks,
    selectedJurisdictions,
    severityOverrides,
  });

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
    // Audit writes must never block or abort the primary pipeline. If the
    // audit database is momentarily unavailable the user still needs their
    // analysis; we swallow errors here and log to console for diagnostics.
    await safeAudit({ kind: 'analyze', payload: { fileName, phase: 'start' } });
    await pipeline.upload(bytes, fileName);
    await safeAudit({ kind: 'analyze', payload: { fileName, phase: 'complete' } });
    void refreshAuditLog();
  }

  async function safeAudit(input: {
    kind: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    try {
      await appendAuditEntry(input);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('audit append failed', err);
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
    await safeAudit({ kind: 'delete-lease', payload: { leaseId: id } });
    await refreshLibrary();
    void refreshAuditLog();
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
    if (selected === null) return;
    await annotationsApi.saveForParagraph(selected.paragraphIndex, text);
  }
  const onUpdateAnnotation = annotationsApi.update;
  const onDeleteAnnotation = annotationsApi.remove;
  const onSaveCounterOffer = counterOffersApi.save;
  const onDeleteCounterOffer = counterOffersApi.remove;

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
    const bytes = await readFileBytes(file);
    const text = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(text);

    // Detect a signed envelope by shape. A signed `.lgpack.json` is the
    // envelope itself (algorithm + payload + signature + publicKey); the
    // inner pack JSON lives as a string under `payload`. Route that case
    // through `saveSignedPack` so the trust badge gets recorded.
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'algorithm' in parsed &&
      'payload' in parsed &&
      'signature' in parsed
    ) {
      const verify = await verifySignedPack(parsed);
      if (!verify.ok || !verify.pack) {
        await safeAudit({
          kind: 'pack-signature-invalid',
          payload: { reason: verify.reason ?? 'unknown' },
        });
        void refreshAuditLog();
        throw new Error(`Invalid signed pack: ${verify.reason ?? 'unknown'}`);
      }
      await saveSignedPack(
        parsed as import('./rules/packSigning').SignedPackEnvelope,
        verify.pack,
      );
      await setPackEnabled(verify.pack.id, true);
      await safeAudit({
        kind: 'pack-signature-verified',
        payload: { packId: verify.pack.id, version: verify.pack.version },
      });
      await safeAudit({
        kind: 'import-pack',
        payload: { packId: verify.pack.id, version: verify.pack.version, signed: true },
      });
      await refreshPacks();
      void refreshAuditLog();
      return;
    }

    const result = validatePackFile(parsed);
    if (!result.ok) {
      throw new Error(`Invalid pack: ${result.errors.join('; ')}`);
    }
    await saveInstalledPack(result.pack);
    await setPackEnabled(result.pack.id, true);
    await safeAudit({
      kind: 'import-pack',
      payload: { packId: result.pack.id, version: result.pack.version },
    });
    await refreshPacks();
    void refreshAuditLog();
  }

  async function onComparePackFile(file: File): Promise<void> {
    try {
      const bytes = await readFileBytes(file);
      const text = new TextDecoder().decode(bytes);
      const parsed: unknown = JSON.parse(text);
      const result = validatePackFile(parsed);
      if (!result.ok) {
        pipeline.setError(`Invalid pack: ${result.errors.join('; ')}`);
        return;
      }
      setPackDiff(diffPack(activeRules, result.pack));
    } catch (err) {
      pipeline.setError(`Could not diff pack: ${friendlyError(err)}`);
    }
  }

  async function onSelectedJurisdictionsChange(next: string[]): Promise<void> {
    setSelectedJurisdictionsState(next);
    await setSelectedJurisdictions(next);
    // Reanalyze fires automatically via useReanalyzeOnRulesChange.
  }

  async function onSeverityOverrideChange(
    ruleId: string,
    panelSeverity: import('./ui/SeverityOverridesPanel').OverrideSeverity | null,
  ): Promise<void> {
    const next = { ...severityOverrides };
    if (panelSeverity === null) {
      delete next[ruleId];
      await setSeverityOverride(ruleId, null);
    } else {
      const real = overrideToSeverity(panelSeverity);
      next[ruleId] = real;
      await setSeverityOverride(ruleId, real);
    }
    setSeverityOverridesState(next);
    // Reanalyze fires automatically via useReanalyzeOnRulesChange.
  }

  async function onRefreshAudit(): Promise<void> {
    await refreshAuditLog();
  }

  async function onVerifyAudit(): Promise<void> {
    setAuditVerification(await verifyAuditChain());
  }

  function onDownloadAudit(): void {
    const json = buildAuditLogJson(auditEntries, auditVerification);
    downloadAuditLogBlob(
      json,
      `leaseguard-audit-${new Date().toISOString().slice(0, 10)}.json`,
    );
  }

  async function onBulkImportFiles(
    files: File[],
    onProgress: (r: BulkResult) => void,
  ): Promise<BulkSummary> {
    const summary = await bulkImport(
      files,
      (r) => {
        onProgress(r);
      },
      {
        analyze: async (bytes) => {
          const result = await analyzeFile(bytes, activeRules);
          return { doc: result.doc, findings: result.findings };
        },
        save: async (input) => saveLease(input),
      },
    );
    await safeAudit({
      kind: 'bulk-import',
      payload: { ok: summary.ok, skipped: summary.skipped, errors: summary.errors },
    });
    await refreshLibrary();
    void refreshAuditLog();
    return summary;
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
    const fileName = status.fileName;
    void safeAudit({
      kind: 'export',
      payload: { fileName, format: 'json' },
    }).then(() => refreshAuditLog());
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

  async function onSaveCustomRule(rule: Rule): Promise<void> {
    // Wrap the single rule as a minimal `.lgpack.json` file so it can live
    // alongside imported packs and flow through the existing enabled-packs
    // resolver. The pack id is derived from the rule id so the user can
    // recognize it in the pack manager.
    const pack: RulePackFile = {
      schema: RULE_PACK_SCHEMA_VERSION,
      id: `custom-${rule.id}`,
      name: `Custom: ${rule.title}`,
      version: '1.0.0',
      description: `User-authored rule "${rule.id}" from the custom rule builder.`,
      rules: [rule],
    };
    await saveInstalledPack(pack);
    await setPackEnabled(pack.id, true);
    await safeAudit({
      kind: 'custom-rule-save',
      payload: { ruleId: rule.id, packId: pack.id },
    });
    await refreshPacks();
    // Reanalyze fires automatically via useReanalyzeOnRulesChange once
    // installedPacks/enabledPacks update.
    void refreshAuditLog();
  }

  async function onEditRedlineParagraph(
    pIndex: number,
    after: string,
  ): Promise<void> {
    if (status.kind !== 'analyzed' || !status.leaseId) return;
    const before = status.result.doc.paragraphs[pIndex]?.text ?? '';
    await saveEdit({
      leaseId: status.leaseId,
      paragraphIndex: pIndex,
      before,
      after,
      updatedAt: new Date().toISOString(),
    });
    await safeAudit({
      kind: 'redline-edit',
      payload: { leaseId: status.leaseId, paragraphIndex: pIndex },
    });
    await refreshRedlineEdits(status.leaseId);
    void refreshAuditLog();
  }

  async function onDeleteRedlineEdit(pIndex: number): Promise<void> {
    if (status.kind !== 'analyzed' || !status.leaseId) return;
    await deleteEdit(status.leaseId, pIndex);
    await safeAudit({
      kind: 'redline-edit',
      payload: { leaseId: status.leaseId, paragraphIndex: pIndex, deleted: true },
    });
    await refreshRedlineEdits(status.leaseId);
    void refreshAuditLog();
  }

  async function onCreateVersion(label?: string, note?: string): Promise<void> {
    if (status.kind !== 'analyzed' || !status.leaseId) return;
    const leaseId = status.leaseId;
    // Snapshot edits live — re-read from storage so we capture anything
    // currently persisted (the in-state `redlineEdits` should match but
    // the storage read is authoritative).
    const currentEdits = await listEditsForLease(leaseId);
    const saved = await saveVersion({
      leaseId,
      edits: currentEdits,
      ...(label !== undefined ? { label } : {}),
      ...(note !== undefined ? { note } : {}),
    });
    await safeAudit({
      kind: 'version-save',
      payload: {
        leaseId,
        versionId: saved.versionId,
        editCount: saved.edits.length,
      },
    });
    await refreshVersions(leaseId);
    void refreshAuditLog();
  }

  async function onRestoreVersion(versionId: string): Promise<void> {
    if (status.kind !== 'analyzed' || !status.leaseId) return;
    const leaseId = status.leaseId;
    const version = await getVersion(versionId);
    if (!version || version.leaseId !== leaseId) return;
    // Replace strategy: delete every currently-stored edit, then save the
    // version's snapshot in. This keeps the redline DB's
    // `(leaseId, paragraphIndex)` uniqueness invariant intact without
    // introducing a new "bulk replace" primitive.
    const current = await listEditsForLease(leaseId);
    for (const e of current) {
      await deleteEdit(leaseId, e.paragraphIndex);
    }
    for (const e of version.edits) {
      await saveEdit({ ...e, leaseId });
    }
    await safeAudit({
      kind: 'version-restore',
      payload: { leaseId, versionId, restoredEdits: version.edits.length },
    });
    await refreshRedlineEdits(leaseId);
    void refreshAuditLog();
  }

  async function onDeleteVersion(versionId: string): Promise<void> {
    if (status.kind !== 'analyzed' || !status.leaseId) return;
    const leaseId = status.leaseId;
    await deleteVersion(versionId);
    await safeAudit({
      kind: 'version-delete',
      payload: { leaseId, versionId },
    });
    await refreshVersions(leaseId);
    void refreshAuditLog();
  }

  async function onExportVersion(versionId: string): Promise<void> {
    if (status.kind !== 'analyzed') return;
    const version = await getVersion(versionId);
    if (!version) return;
    const html = buildRedlineHtml({
      leaseName: status.fileName,
      doc: status.result.doc,
      edits: version.edits,
    });
    const labelPart = version.label ? `-${version.label.replace(/[^a-z0-9-]+/gi, '_')}` : '';
    downloadBlob(
      html,
      'text/html',
      `${status.fileName.replace(/\.pdf$/i, '')}-redline${labelPart}.html`,
    );
  }

  /**
   * Map a paragraph index to its section label, if the parser identified a
   * section. Searches `doc.sections` for the section containing this
   * paragraph's text — cheap enough at redline scale (sections are small).
   * Returns `undefined` to let `buildSideLetterHtml` fall back to
   * `Page N, \u00b6 M` labeling.
   */
  function sectionForParagraph(paragraphIndex: number): string | undefined {
    if (status.kind !== 'analyzed') return undefined;
    const paragraph = status.result.doc.paragraphs[paragraphIndex];
    if (!paragraph) return undefined;
    for (const section of status.result.doc.sections) {
      if (section.paragraphs.includes(paragraph)) {
        return section.number ?? section.heading;
      }
    }
    return undefined;
  }

  function onSideLetterPreview(): void {
    if (status.kind !== 'analyzed') return;
    const html = buildSideLetterHtml({
      leaseName: status.fileName,
      edits: redlineEdits,
      sectionFor: sectionForParagraph,
      signer:
        sideLetterSigner.name.trim() !== ''
          ? {
              name: sideLetterSigner.name.trim(),
              ...(sideLetterSigner.title.trim() !== ''
                ? { title: sideLetterSigner.title.trim() }
                : {}),
            }
          : undefined,
    });
    // Open in a popup window. Falls back gracefully when the browser blocks
    // the popup by downloading instead — keeps the UI discoverable.
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    } else {
      onSideLetterDownload();
    }
  }

  function onSideLetterDownload(): void {
    if (status.kind !== 'analyzed') return;
    const html = buildSideLetterHtml({
      leaseName: status.fileName,
      edits: redlineEdits,
      sectionFor: sectionForParagraph,
      signer:
        sideLetterSigner.name.trim() !== ''
          ? {
              name: sideLetterSigner.name.trim(),
              ...(sideLetterSigner.title.trim() !== ''
                ? { title: sideLetterSigner.title.trim() }
                : {}),
            }
          : undefined,
    });
    downloadBlob(
      html,
      'text/html',
      `${status.fileName.replace(/\.pdf$/i, '')}-side-letter.html`,
    );
  }

  function onExportRedlineHtml(): void {
    if (status.kind !== 'analyzed') return;
    const html = buildRedlineHtml({
      leaseName: status.fileName,
      doc: status.result.doc,
      edits: redlineEdits,
    });
    downloadBlob(
      html,
      'text/html',
      `${status.fileName.replace(/\.pdf$/i, '')}-redline.html`,
    );
  }

  async function onApplySuggestion(
    _finding: Finding,
    paragraphIndex: number,
    suggestedText: string,
  ): Promise<void> {
    if (status.kind !== 'analyzed' || !status.leaseId) return;
    const before = status.result.doc.paragraphs[paragraphIndex]?.text ?? '';
    await saveEdit({
      leaseId: status.leaseId,
      paragraphIndex,
      before,
      after: suggestedText,
      updatedAt: new Date().toISOString(),
      ruleId: _finding.ruleId,
    });
    await safeAudit({
      kind: 'redline-edit',
      payload: {
        leaseId: status.leaseId,
        paragraphIndex,
        ruleId: _finding.ruleId,
        applied: true,
      },
    });
    await refreshRedlineEdits(status.leaseId);
    void refreshAuditLog();
    setView('redline');
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
        <div role="group" aria-label="view mode" className="view-toggle">
          <button
            type="button"
            aria-pressed={view === 'current'}
            onClick={() => setView('current')}
          >
            Current lease
          </button>
          <button
            type="button"
            aria-pressed={view === 'portfolio'}
            onClick={() => setView('portfolio')}
          >
            Portfolio
          </button>
          {status.kind === 'analyzed' && (
            <button
              type="button"
              aria-pressed={view === 'redline'}
              onClick={() => setView('redline')}
            >
              Redline
            </button>
          )}
        </div>
      </header>

      {view === 'current' && status.kind === 'loading' && (
        <p role="status" aria-live="polite">
          Analyzing {status.fileName}…
        </p>
      )}

      {view === 'current' && status.kind === 'error' && (
        <p role="alert">Could not analyze this file: {status.message}</p>
      )}

      {view === 'portfolio' && (
        <PortfolioPanel
          leases={library}
          findingsByLease={portfolioFindings}
          onOpenLease={(id) => {
            setView('current');
            void onOpenLibrary(id);
          }}
        />
      )}

      {view === 'redline' && status.kind === 'analyzed' && (
        <>
          <RedlinePanel
            doc={status.result.doc}
            edits={redlineEdits}
            onEditParagraph={(pIdx, after) => {
              void onEditRedlineParagraph(pIdx, after);
            }}
            onDeleteEdit={(pIdx) => {
              void onDeleteRedlineEdit(pIdx);
            }}
            onExportHtml={onExportRedlineHtml}
          />
          <details>
            <summary>Version history</summary>
            <VersionHistoryPanel
              versions={versions}
              currentEditCount={redlineEdits.length}
              onCreateVersion={(label, note) => {
                void onCreateVersion(label, note);
              }}
              onRestoreVersion={(vId) => {
                void onRestoreVersion(vId);
              }}
              onDeleteVersion={(vId) => {
                void onDeleteVersion(vId);
              }}
              onExportVersion={(vId) => {
                void onExportVersion(vId);
              }}
            />
          </details>
          <SideLetterPanel
            leaseName={status.fileName}
            edits={redlineEdits}
            signerDraft={sideLetterSigner}
            onSignerChange={(s) => setSideLetterSigner(s)}
            onPreview={onSideLetterPreview}
            onDownload={onSideLetterDownload}
          />
        </>
      )}

      {view === 'current' && status.kind === 'analyzed' && (
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
              definitions={extractLeaseFacts(status.result.doc).definitions}
              plainEnglishByRuleId={plainEnglishByRuleId}
              suggestedTextByRuleId={suggestedTextByRuleId}
              onApplySuggestion={(f, pIdx, text) => {
                void onApplySuggestion(f, pIdx, text);
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
            suggestedEdit={
              selected ? suggestedEditByRuleId[selected.ruleId] : undefined
            }
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
        signatureStatusByPackId={packSignatureStatus}
      />

      <details>
        <summary>Custom rule builder</summary>
        <CustomRuleBuilderPanel
          doc={status.kind === 'analyzed' ? status.result.doc : null}
          existingRuleIds={existingRuleIds}
          onSave={(rule) => {
            void onSaveCustomRule(rule);
          }}
        />
      </details>

      <JurisdictionPickerPanel
        available={JURISDICTION_OPTIONS.map((j) => j.code)}
        selected={selectedJurisdictions}
        onChange={(next) => {
          void onSelectedJurisdictionsChange(next);
        }}
      />

      <SeverityOverridesPanel
        rules={activeRules.map((r) => ({
          id: r.id,
          title: r.title,
          severity: severityToOverrideSeverity(r.severity),
        }))}
        overrides={overridesToPanel(severityOverrides)}
        onChange={(ruleId, sev) => {
          void onSeverityOverrideChange(ruleId, sev);
        }}
      />

      <section aria-label="diff rule pack">
        <h2>Diff rule pack</h2>
        <p>
          Load a <code>.lgpack.json</code> file to see how it differs from the
          currently active rule set. Nothing is saved until you import it via
          the pack manager above.
        </p>
        <label>
          <span className="visually-hidden">Pack file to diff</span>
          <input
            type="file"
            accept=".lgpack.json,application/json"
            aria-label="pack file to diff"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onComparePackFile(f);
            }}
          />
        </label>
        {packDiff && <PackDiffPanel diff={packDiff} />}
      </section>

      <BulkImportPanel
        onImport={(files, onProgress) => onBulkImportFiles(files, onProgress)}
      />

      <AuditLogPanel
        entries={auditEntries}
        verification={auditVerification}
        onRefresh={() => {
          void onRefreshAudit();
        }}
        onVerify={() => {
          void onVerifyAudit();
        }}
        onDownload={onDownloadAudit}
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
          {...(comparison.a.rulePackVersion !== comparison.b.rulePackVersion
            ? {
                packVersionMismatch: {
                  a: comparison.a.rulePackVersion,
                  b: comparison.b.rulePackVersion,
                },
              }
            : {})}
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
