import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import { usePipeline } from './App/usePipeline';
import { usePackManager } from './App/usePackManager';
import { useAnnotations } from './App/useAnnotations';
import { useRedlineState } from './App/useRedlineState';
import { useVersionHistory } from './App/useVersionHistory';
import { useSideLetter } from './App/useSideLetter';
import { useCounterOffers } from './App/useCounterOffers';
import { useSigningKey } from './App/useSigningKey';
import { useReanalyzeOnRulesChange } from './App/useReanalyzeOnRulesChange';
import {
  buildIcsBytes,
  clearAllFlow,
  downloadBlob,
  downloadBlobBytes,
  downloadHandoffZip,
  exportEncryptedArchiveFlow,
  exportFindingsAsHtml,
  exportFindingsAsJson,
  friendlyError,
  importEncryptedArchiveFlow,
  readFileBytes,
  stripPdfExt,
} from './App/appHelpers';
import { FindingsPanel } from './ui/FindingsPanel';
import { loadGlossary, type GlossaryEntry } from './glossary/loadGlossary';
import { LibraryPanel } from './ui/LibraryPanel';
import { PdfViewer } from './ui/PdfViewer';
import { ComparePanel } from './ui/ComparePanel';
import { LibraryCompareForm } from './ui/LibraryCompareForm';
import { TemplatesPanel } from './ui/TemplatesPanel';
import { TemplateMatchesPanel } from './ui/TemplateMatchesPanel';
import { LeaseFactsPanel } from './ui/LeaseFactsPanel';
import { extractLeaseFacts } from './facts/extractFacts';
import { WorkflowPanel } from './ui/WorkflowPanel';
import { buildSummary, copyToClipboard } from './workflow/copySummary';
import { PackManagerPanel } from './ui/PackManagerPanel';
import { JURISDICTION_OPTIONS } from './rules/jurisdictions';
import { JurisdictionPickerPanel } from './ui/JurisdictionPickerPanel';
import { SeverityOverridesPanel } from './ui/SeverityOverridesPanel';
import { PackDiffPanel } from './ui/PackDiffPanel';
import { AuditLogPanel } from './ui/AuditLogPanel';
import { BulkImportPanel } from './ui/BulkImportPanel';
import {
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
import { AnnotationsPanel } from './ui/AnnotationsPanel';
import { CounterOfferPanel } from './ui/CounterOfferPanel';
import type { CounterOffer } from './negotiation/counterOffers';
import { PortfolioPanel } from './ui/PortfolioPanel';
import { ClauseSimilarityPanel } from './ui/ClauseSimilarityPanel';
import { clusterParagraphs, type ClauseCluster } from './portfolio/clauseClusters';
import { paragraphShingles } from './portfolio/shingles';
import { CustomRuleBuilderPanel } from './ui/CustomRuleBuilderPanel';
import { RedlinePanel } from './ui/RedlinePanel';
import { VersionHistoryPanel } from './ui/VersionHistoryPanel';
import { SideLetterPanel } from './ui/SideLetterPanel';
import { needsOcr } from './compare/needsOcr';
import { discoverOcrLanguages, type OcrLanguage } from './ocr/availableLanguages';
import { OcrLanguagePickerPanel } from './ui/OcrLanguagePickerPanel';
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
  clearStandardId,
  deleteLease,
  getLease,
  getOnboardingDismissedAt,
  getStandardId,
  listAllLeaseRecords,
  listLeases,
  putParagraphShingles,
  renameLease,
  setOnboardingDismissedAt,
  setStandardId,
  type LeaseMetadata,
  type LeaseRecord,
} from './storage/storage';
import { OnboardingTour } from './ui/OnboardingTour';
import { I18nProvider } from './i18n/I18nProvider';
import { useI18n } from './i18n/I18nContext';
import { LocalePickerPanel } from './ui/LocalePickerPanel';

async function persistShingles(records: LeaseRecord[]): Promise<void> {
  for (const record of records) {
    const paragraphs = record.doc?.paragraphs ?? [];
    for (let i = 0; i < paragraphs.length; i++) {
      const text = paragraphs[i]?.text ?? '';
      const shingles = paragraphShingles(text);
      try {
        await putParagraphShingles({
          leaseId: record.id,
          paragraphIndex: i,
          shingles,
        });
      } catch {
        // Ignore individual write failures — clustering already succeeded.
      }
    }
  }
}

export function App(): JSX.Element {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}

function AppContent(): JSX.Element {
  const { t } = useI18n();
  const [selected, setSelected] = useState<Finding | null>(null);
  const [library, setLibrary] = useState<LeaseMetadata[]>([]);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [standardId, setStandardIdState] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ClauseTemplate[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditVerification, setAuditVerification] = useState<ChainVerification | null>(null);
  const [view, setView] = useState<'current' | 'portfolio' | 'redline'>('current');
  const [portfolioFindings, setPortfolioFindings] = useState<Map<string, Finding[]>>(
    new Map(),
  );
  const [clauseClusters, setClauseClusters] = useState<ClauseCluster[]>([]);
  // `undefined` = "not yet loaded from IDB" — we render nothing for the tour
  // until we know, so first-run users don't see a flash-of-modal followed by
  // dismissal. `null` = first run, show the tour. number = already dismissed.
  const [onboardingDismissedAt, setOnboardingDismissedAtState] = useState<
    number | null | undefined
  >(undefined);
  // Static legal glossary (Wave 11 Part A): loaded once at mount via the
  // single same-origin fetch the app makes. Failures fall back to [].
  const [glossaryEntries, setGlossaryEntries] = useState<GlossaryEntry[]>([]);
  const [ocrLanguages, setOcrLanguages] = useState<OcrLanguage[]>([]);
  const [ocrLanguage, setOcrLanguage] = useState<string>('eng');

  useEffect(() => {
    void discoverOcrLanguages().then((langs) => {
      setOcrLanguages(langs);
      if (langs.length > 0 && !langs.some((l) => l.code === 'eng')) {
        const first = langs[0];
        if (first) setOcrLanguage(first.code);
      }
    });
  }, []);

  useEffect(() => {
    void getOnboardingDismissedAt().then((ts) => setOnboardingDismissedAtState(ts));
  }, []);

  useEffect(() => {
    void loadGlossary().then((g) => setGlossaryEntries(g.entries));
  }, []);

  const dismissOnboarding = useCallback(async (): Promise<void> => {
    const ts = Date.now();
    setOnboardingDismissedAtState(ts);
    await setOnboardingDismissedAt(ts);
  }, []);

  const refreshAuditLog = useCallback(async (): Promise<void> => {
    setAuditEntries(await listAuditEntries());
  }, []);

  // Audit writes must never abort the primary pipeline; swallow + warn.
  const safeAudit = useCallback(
    async (input: { kind: string; payload: Record<string, unknown> }): Promise<void> => {
      try {
        await appendAuditEntry(input);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('audit append failed', err);
      }
    },
    [],
  );

  const refreshLibrary = useCallback(async (): Promise<void> => {
    const [leases, std] = await Promise.all([listLeases(), getStandardId()]);
    setLibrary(leases);
    setStandardIdState(std ?? null);
  }, []);

  const refreshTemplates = useCallback(async (): Promise<void> => {
    setTemplates(await listTemplates());
  }, []);

  const packs = usePackManager({
    audit: safeAudit,
    onAuditMutation: refreshAuditLog,
    onError: (msg) => pipeline.setError(msg),
    onBulkImportComplete: refreshLibrary,
  });

  const pipeline = usePipeline({
    onLibraryChange: refreshLibrary,
    rules: packs.activeRules,
  });
  const { status, ocrState, comparison } = pipeline;
  const analyzedLeaseId = status.kind === 'analyzed' ? status.leaseId : null;

  const annotationsApi = useAnnotations(analyzedLeaseId);
  const redline = useRedlineState({
    leaseId: analyzedLeaseId,
    audit: safeAudit,
    onAuditMutation: refreshAuditLog,
  });
  const versionHistory = useVersionHistory({
    leaseId: analyzedLeaseId,
    audit: safeAudit,
    onAuditMutation: refreshAuditLog,
  });
  const sideLetter = useSideLetter();
  const counters = useCounterOffers();
  const signingKey = useSigningKey();

  // Keystone: replaces every manual `pipeline.reanalyze()` call. Uses a
  // content fingerprint of the underlying inputs (not the derived
  // `activeRules` array) so an unmemoized base array upstream cannot
  // cause an infinite render loop. Skip-first-mount dedupes the
  // redundant analyze right after upload already analyzed.
  useReanalyzeOnRulesChange({
    statusKind: pipeline.status.kind,
    reanalyze: pipeline.reanalyze,
    installedPacks: packs.installedPacks,
    enabledPackIds: packs.enabledPacks,
    selectedJurisdictions: packs.selectedJurisdictions,
    severityOverrides: packs.severityOverrides,
  });

  const plainEnglishByRuleId = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const r of packs.activeRules) if (r.plainEnglish) out[r.id] = r.plainEnglish;
    return out;
  }, [packs.activeRules]);

  const suggestedEditByRuleId = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const r of packs.activeRules) if (r.suggestedEdit) out[r.id] = r.suggestedEdit;
    return out;
  }, [packs.activeRules]);

  // User counter-offers override the rule's `suggestedEdit`. Most recent wins per rule.
  const suggestedTextByRuleId = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = { ...suggestedEditByRuleId };
    const latestByRule = new Map<string, CounterOffer>();
    for (const co of counters.counterOffers) {
      const cur = latestByRule.get(co.ruleId);
      if (!cur || co.updatedAt > cur.updatedAt) latestByRule.set(co.ruleId, co);
    }
    for (const [ruleId, co] of latestByRule) out[ruleId] = co.text;
    return out;
  }, [suggestedEditByRuleId, counters.counterOffers]);

  useEffect(() => {
    void refreshLibrary();
    void refreshTemplates();
    void refreshAuditLog();
  }, [refreshLibrary, refreshTemplates, refreshAuditLog]);

  useEffect(() => {
    if (view === 'portfolio') {
      void (async (): Promise<void> => {
        const records = await listAllLeaseRecords();
        const map = new Map<string, Finding[]>();
        for (const r of records) map.set(r.id, r.findings);
        setPortfolioFindings(map);
        // Wave 10-B: cluster paragraphs and write-through shingles to IDB so
        // a future cross-cluster pass can read them without re-tokenizing.
        // Failures are logged and dropped — clustering must not block the
        // portfolio view.
        try {
          const clusters = clusterParagraphs(records);
          setClauseClusters(clusters);
          await persistShingles(records);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.warn('clause similarity failed', err);
          setClauseClusters([]);
        }
      })();
    }
  }, [view, library]);

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
    await safeAudit({ kind: 'analyze', payload: { fileName, phase: 'start' } });
    await pipeline.upload(bytes, fileName);
    await safeAudit({ kind: 'analyze', payload: { fileName, phase: 'complete' } });
    void refreshAuditLog();
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

  async function onCompare(aId: string, bId: string): Promise<void> {
    const [a, b] = await Promise.all([getLease(aId), getLease(bId)]);
    if (!a || !b) return;
    pipeline.setComparison({ a, b });
  }

  async function onImportArchiveFile(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await importEncryptedArchiveFlow(file, {
      onSuccess: async () => {
        await refreshLibrary();
        pipeline.reset();
        setSelected(null);
      },
      onError: (msg) => pipeline.setError(msg),
    });
  }

  async function onExportSignedJson(): Promise<void> {
    if (status.kind !== 'analyzed') return;
    const passphrase = window.prompt('Passphrase to unlock the signing key:');
    if (!passphrase) return;
    try {
      await signingKey.signAndDownloadFindings({
        fileName: status.fileName,
        doc: status.result.doc,
        findings: status.result.findings,
        bytes: status.bytes,
        passphrase,
      });
    } catch (err) {
      pipeline.setError(`Signing failed: ${friendlyError(err)}`);
    }
  }

  function onExportJson(): void {
    if (status.kind !== 'analyzed') return;
    exportFindingsAsJson({
      fileName: status.fileName,
      doc: status.result.doc,
      findings: status.result.findings,
    });
    void safeAudit({
      kind: 'export',
      payload: { fileName: status.fileName, format: 'json' },
    }).then(() => refreshAuditLog());
  }

  function onBuildIcs(): void {
    if (status.kind !== 'analyzed') return;
    const ics = buildIcsBytes({ fileName: status.fileName, doc: status.result.doc });
    if (!ics) {
      pipeline.setError('No dates found in this lease to export to .ics.');
      return;
    }
    downloadBlobBytes(ics.bytes, 'text/calendar', ics.filename);
  }

  // Map a paragraph index to a section label, for side-letter clause headings.
  const sectionForParagraph = useCallback(
    (paragraphIndex: number): string | undefined => {
      if (status.kind !== 'analyzed') return undefined;
      const paragraph = status.result.doc.paragraphs[paragraphIndex];
      if (!paragraph) return undefined;
      for (const section of status.result.doc.sections) {
        if (section.paragraphs.includes(paragraph)) {
          return section.number ?? section.heading;
        }
      }
      return undefined;
    },
    [status],
  );


  return (
    <main>
      {onboardingDismissedAt !== undefined && (
        <OnboardingTour
          dismissedAt={onboardingDismissedAt}
          onDismiss={() => {
            void dismissOnboarding();
          }}
        />
      )}
      <header>
        <h1>{t('app.title')}</h1>
        <p>{t('app.tagline')}</p>
        <LocalePickerPanel />
        <details className="privacy">
          <summary>{t('header.privacy.summary')}</summary>
          <ul>
            <li>The PDF is parsed entirely in your browser via pdf.js.</li>
            <li>All storage is in IndexedDB on this device. No account, no sync.</li>
            <li>
              A strict Content-Security-Policy (<code>default-src &apos;self&apos;</code>)
              blocks this page from loading scripts, fonts, or data from any other
              origin.
            </li>
            <li>LeaseGuard is not legal advice. Findings are heuristic pattern matches.</li>
          </ul>
        </details>
        <label>
          <span className="visually-hidden">Upload lease</span>
          <input
            type="file"
            accept="application/pdf"
            aria-label="upload lease"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await handleBytes(await readFileBytes(file), file.name);
            }}
          />
        </label>
        <button type="button" onClick={() => void onTrySample()}>{t('header.trySample')}</button>
        <div role="group" aria-label="view mode" className="view-toggle">
          <button type="button" aria-pressed={view === 'current'} onClick={() => setView('current')}>
            {t('header.view.current')}
          </button>
          <button type="button" aria-pressed={view === 'portfolio'} onClick={() => setView('portfolio')}>
            {t('header.view.portfolio')}
          </button>
          {status.kind === 'analyzed' && (
            <button type="button" aria-pressed={view === 'redline'} onClick={() => setView('redline')}>
              {t('header.view.redline')}
            </button>
          )}
        </div>
      </header>

      {view === 'current' && status.kind === 'loading' && (
        <p role="status" aria-live="polite">Analyzing {status.fileName}…</p>
      )}
      {view === 'current' && status.kind === 'error' && (
        <p role="alert">Could not analyze this file: {status.message}</p>
      )}

      {view === 'portfolio' && (
        <>
          <PortfolioPanel
            leases={library}
            findingsByLease={portfolioFindings}
            onOpenLease={(id) => {
              setView('current');
              void onOpenLibrary(id);
            }}
          />
          <ClauseSimilarityPanel
            clusters={clauseClusters}
            onOpenParagraph={(leaseId, _paragraphIndex) => {
              setView('current');
              void onOpenLibrary(leaseId);
            }}
          />
        </>
      )}

      {view === 'redline' && status.kind === 'analyzed' && (
        <>
          <RedlinePanel
            doc={status.result.doc}
            edits={redline.redlineEdits}
            onEditParagraph={(pIdx, after) => {
              const before =
                status.kind === 'analyzed'
                  ? (status.result.doc.paragraphs[pIdx]?.text ?? '')
                  : '';
              void redline.editParagraph({ paragraphIndex: pIdx, before, after });
            }}
            onDeleteEdit={(pIdx) => void redline.deleteParagraphEdit(pIdx)}
            onExportHtml={() => {
              if (status.kind !== 'analyzed') return;
              downloadBlob(
                redline.buildHtml({ leaseName: status.fileName, doc: status.result.doc }),
                'text/html',
                `${stripPdfExt(status.fileName)}-redline.html`,
              );
            }}
          />
          <details>
            <summary>Version history</summary>
            <VersionHistoryPanel
              versions={versionHistory.versions}
              currentEditCount={redline.redlineEdits.length}
              onCreateVersion={(label, note) => void versionHistory.createVersion(label, note)}
              onRestoreVersion={(vId) =>
                void versionHistory.restoreVersion(vId, redline.replaceAll)
              }
              onDeleteVersion={(vId) => void versionHistory.removeVersion(vId)}
              onExportVersion={(vId) => {
                if (status.kind !== 'analyzed') return;
                void versionHistory.exportVersion(vId, {
                  leaseName: status.fileName,
                  doc: status.result.doc,
                });
              }}
            />
          </details>
          <SideLetterPanel
            leaseName={status.fileName}
            edits={redline.redlineEdits}
            signerDraft={sideLetter.signerDraft}
            onSignerChange={(s) => sideLetter.setSignerDraft(s)}
            onPreview={() => {
              if (status.kind !== 'analyzed') return;
              sideLetter.preview({
                leaseName: status.fileName,
                edits: redline.redlineEdits,
                sectionFor: sectionForParagraph,
              });
            }}
            onDownload={() => {
              if (status.kind !== 'analyzed') return;
              sideLetter.download({
                leaseName: status.fileName,
                edits: redline.redlineEdits,
                sectionFor: sectionForParagraph,
              });
            }}
          />
        </>
      )}

      {view === 'current' && status.kind === 'analyzed' && (
        <div className="results">
          <div className="results-actions">
            <button type="button" onClick={onExportJson}>{t('findings.export.json')}</button>
            <button
              type="button"
              onClick={() => {
                if (status.kind !== 'analyzed') return;
                exportFindingsAsHtml({
                  fileName: status.fileName,
                  doc: status.result.doc,
                  findings: status.result.findings,
                });
              }}
            >
              {t('findings.export.html')}
            </button>
            {signingKey.publicKey !== null && (
              <button type="button" onClick={() => void onExportSignedJson()}>
                {t('findings.export.signed')}
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
                  <button type="button" onClick={() => { setSelected(null); void pipeline.ocr(ocrLanguage); }}>
                    Attempt OCR
                  </button>
                )}
                <OcrLanguagePickerPanel
                  available={ocrLanguages}
                  selected={ocrLanguage}
                  onChange={setOcrLanguage}
                />
                {ocrState.kind === 'running' && (
                  <p aria-live="polite" className="ocr-progress">
                    Running OCR: {ocrState.stage} ({Math.round(ocrState.pct * 100)}%)
                  </p>
                )}
                {ocrState.kind === 'error' && <p role="alert">OCR failed: {ocrState.message}</p>}
              </div>
            );
          })()}
          <div className="split">
            <FindingsPanel
              findings={status.result.findings}
              onSelect={(f) => { setSelected(f); setSelectedPage(f.page); }}
              definitions={extractLeaseFacts(status.result.doc).definitions}
              glossary={glossaryEntries}
              plainEnglishByRuleId={plainEnglishByRuleId}
              suggestedTextByRuleId={suggestedTextByRuleId}
              onApplySuggestion={(f, pIdx, text) => {
                if (status.kind !== 'analyzed' || !status.leaseId) return;
                void redline
                  .applySuggestion({
                    finding: f,
                    paragraphIndex: pIdx,
                    suggestedText: text,
                    doc: status.result.doc,
                  })
                  .then(() => setView('redline'));
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
            annotations={annotationsApi.annotations}
            onSave={(text) => {
              if (!analyzedLeaseId || selected === null) return;
              void annotationsApi.save({
                leaseId: analyzedLeaseId,
                paragraphIndex: selected.paragraphIndex,
                text,
              });
            }}
            onUpdate={(id, text) => void annotationsApi.update(id, text)}
            onDelete={(id) => void annotationsApi.remove(id)}
          />
          <CounterOfferPanel
            finding={selected}
            counters={counters.counterOffers}
            onSave={(ruleId, name, text) => void counters.save(ruleId, name, text)}
            onDelete={(id) => void counters.remove(id)}
            suggestedEdit={selected ? suggestedEditByRuleId[selected.ruleId] : undefined}
          />
          <TemplateMatchesPanel matches={matchTemplates(templates, status.result.doc)} />
          <LeaseFactsPanel facts={extractLeaseFacts(status.result.doc)} />
          <WorkflowPanel
            leaseName={status.fileName}
            findings={status.result.findings}
            onBuildIcs={onBuildIcs}
            onCopySummary={async () => {
              if (status.kind !== 'analyzed') return;
              await copyToClipboard(
                buildSummary({ leaseName: status.fileName, findings: status.result.findings }),
              );
            }}
            onDownloadHandoff={() => {
              if (status.kind !== 'analyzed') return;
              downloadHandoffZip({
                fileName: status.fileName,
                doc: status.result.doc,
                findings: status.result.findings,
                bytes: status.bytes,
              });
            }}
          />
        </div>
      )}

      <LibraryPanel
        leases={library}
        standardId={standardId}
        onOpen={(id) => void onOpenLibrary(id)}
        onDelete={(id) => void onDeleteLibrary(id)}
        onSetStandard={(id) => void setStandardId(id).then(refreshLibrary)}
        onRename={(id, name) => void renameLease(id, name).then(refreshLibrary)}
      />

      <LibraryCompareForm leases={library} onCompare={(a, b) => void onCompare(a, b)} />

      <TemplatesPanel
        templates={templates}
        onSave={(input) => void saveTemplate(input).then(refreshTemplates)}
        onUpdate={(id, patch) => void updateTemplate(id, patch).then(refreshTemplates)}
        onDelete={(id) => void deleteTemplate(id).then(refreshTemplates)}
      />

      <PackManagerPanel
        builtInName="Built-in rules (v1)"
        installed={packs.installedPacks}
        enabled={packs.enabledPacks}
        onImport={packs.importPackFile}
        onToggle={(id, enabled) => void packs.togglePack(id, enabled)}
        onDelete={(id) => void packs.deletePack(id)}
        signatureStatusByPackId={packs.packSignatureStatus}
      />

      <details>
        <summary>Custom rule builder</summary>
        <CustomRuleBuilderPanel
          doc={status.kind === 'analyzed' ? status.result.doc : null}
          existingRuleIds={packs.existingRuleIds}
          onSave={(rule) => void packs.saveCustomRule(rule)}
        />
      </details>

      <JurisdictionPickerPanel
        available={JURISDICTION_OPTIONS.map((j) => j.code)}
        selected={packs.selectedJurisdictions}
        onChange={(next) => void packs.setSelectedJurisdictions(next)}
      />

      <SeverityOverridesPanel
        rules={packs.activeRules.map((r) => ({
          id: r.id,
          title: r.title,
          severity: severityToOverrideSeverity(r.severity),
        }))}
        overrides={overridesToPanel(packs.severityOverrides)}
        onChange={(ruleId, sev) => void packs.setSeverityOverride(ruleId, sev)}
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
              if (f) void packs.comparePackFile(f);
            }}
          />
        </label>
        {packs.packDiff && <PackDiffPanel diff={packs.packDiff} />}
      </section>

      <BulkImportPanel onImport={(files, onProgress) => packs.bulkImportFiles(files, onProgress)} />

      <AuditLogPanel
        entries={auditEntries}
        verification={auditVerification}
        onRefresh={() => void refreshAuditLog()}
        onVerify={() => {
          void (async (): Promise<void> => {
            setAuditVerification(await verifyAuditChain());
          })();
        }}
        onDownload={() => {
          const json = buildAuditLogJson(auditEntries, auditVerification);
          downloadAuditLogBlob(
            json,
            `leaseguard-audit-${new Date().toISOString().slice(0, 10)}.json`,
          );
        }}
      />

      <SigningKeyPanel
        state={{ publicKey: signingKey.publicKey }}
        onCreateKey={(pp) => void signingKey.createKey(pp)}
        onExportPublicKey={(pk) => void signingKey.exportKeyToClipboard(pk)}
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
        <button type="button" onClick={() => void exportEncryptedArchiveFlow()}>
          {t('footer.archive.export')}
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
        <button
          type="button"
          onClick={() => {
            void clearAllFlow({
              onCleared: async () => {
                await refreshLibrary();
                await refreshTemplates();
                pipeline.reset();
                setSelected(null);
              },
            });
          }}
        >
          {t('footer.clearAll')}
        </button>
      </footer>
    </main>
  );
}
