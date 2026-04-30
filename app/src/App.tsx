import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { usePipeline } from './App/usePipeline';
import { usePackManager } from './App/usePackManager';
import { useAnnotations } from './App/useAnnotations';
import { useRedlineState } from './App/useRedlineState';
import { useVersionHistory } from './App/useVersionHistory';
import { useSideLetter } from './App/useSideLetter';
import { useCounterOffers } from './App/useCounterOffers';
import { useDerivedAppState } from './App/useDerivedAppState';
import { useSigningKey } from './App/useSigningKey';
import { useReanalyzeOnRulesChange } from './App/useReanalyzeOnRulesChange';
import {
  buildIcsBytes,
  clearAllFlow,
  downloadBlobBytes,
  exportEncryptedArchiveFlow,
  exportFindingsAsJson,
  readFileBytes,
} from './App/appHelpers';
import { loadGlossary, type GlossaryEntry } from './glossary/loadGlossary';
import { loadCuratedManifest, type CuratedPackEntry } from './rules/curatedPacks';
import { validatePackFile } from './rules/packSchema';
import { diffPack } from './rules/packDiff';
import { verifySignedPack } from './rules/packSigning';
import { JURISDICTION_OPTIONS } from './rules/jurisdictions';
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
import { PortfolioPanel } from './ui/PortfolioPanel';
import { paragraphShingles } from './portfolio/shingles';
// Wave 33-B — AppRedlinePane and its three child panels (RedlinePanel,
// VersionHistoryPanel, SideLetterPanel) only render when the user switches
// to the redline view tab. Lazy-loading lets the shell skip ~the entire
// redline subsystem on first paint. Pattern matches HybridFeedbackButton
// (Wave 29-C) and HybridPrecisionDisclosure (Wave 30-A).
const AppRedlinePane = lazy(() =>
  import('./ui/AppRedlinePane').then((m) => ({ default: m.AppRedlinePane })),
);
import { discoverOcrLanguages, type OcrLanguage } from './ocr/availableLanguages';
import type { Finding } from './rules/types';
import type { ClauseTemplate } from './templates/types';
import { saveTemplate, listTemplates, updateTemplate, deleteTemplate } from './storage/templates';
import {
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
import { AppHeader } from './ui/AppHeader';
import { AppCurrentPane } from './ui/AppCurrentPane';
import { AppLibraryAndPacksPane } from './ui/AppLibraryAndPacksPane';
import { AppSettingsPane } from './ui/AppSettingsPane';
import { useAppCallbacks } from './App/useAppCallbacks';
import { StandardSuitePanel } from './ui/StandardSuitePanel';
import {
  deleteStandard,
  listStandards,
  promoteToStandard,
  type StandardClause,
} from './clauseStandard/standardSuite';

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
  const [selected, setSelected] = useState<Finding | null>(null);
  const [library, setLibrary] = useState<LeaseMetadata[]>([]);
  const [selectedPage, setSelectedPage] = useState<number | null>(null);
  const [standardId, setStandardIdState] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ClauseTemplate[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditVerification, setAuditVerification] = useState<ChainVerification | null>(null);
  const [view, setView] = useState<'current' | 'portfolio' | 'redline' | 'settings'>('current');
  const [portfolioFindings, setPortfolioFindings] = useState<Map<string, Finding[]>>(new Map());
  const [standardSuite, setStandardSuite] = useState<StandardClause[]>([]);

  const refreshStandardSuite = useCallback(async (): Promise<void> => {
    setStandardSuite(await listStandards());
  }, []);
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
    audit: safeAudit,
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

  const {
    plainEnglishByRuleId,
    suggestedEditByRuleId,
    suggestedTextByRuleId,
    sectionForParagraph,
  } = useDerivedAppState({
    activeRules: packs.activeRules,
    counterOffers: counters.counterOffers,
    doc: status.kind === 'analyzed' ? status.result.doc : null,
  });

  useEffect(() => {
    void refreshLibrary();
    void refreshTemplates();
    void refreshAuditLog();
    void refreshStandardSuite();
  }, [refreshLibrary, refreshTemplates, refreshAuditLog, refreshStandardSuite]);

  useEffect(() => {
    if (view === 'portfolio') {
      void (async (): Promise<void> => {
        const records = await listAllLeaseRecords();
        const map = new Map<string, Finding[]>();
        for (const r of records) map.set(r.id, r.findings);
        setPortfolioFindings(map);
        // Wave 10-B: write-through shingles to IDB so a future cross-cluster
        // pass can read them without re-tokenizing. Failures are logged and
        // dropped — shingle persistence must not block the portfolio view.
        try {
          await persistShingles(records);
        } catch (err) {
          console.warn('shingle persistence failed', err);
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

  const {
    handleBytes,
    onTrySample,
    onOpenLibrary,
    onDeleteLibrary,
    onCompare,
    onImportArchiveFile,
    onExportSignedJson,
  } = useAppCallbacks({
    pipeline,
    signingKey,
    safeAudit,
    refreshAuditLog,
    refreshLibrary,
    setSelected,
    standardId,
  });

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

  return (
    <main>
      {onboardingDismissedAt !== undefined && (
        <OnboardingTour
          dismissedAt={onboardingDismissedAt}
          viewMode={view}
          onDismiss={() => {
            void dismissOnboarding();
          }}
        />
      )}
      <AppHeader
        view={view}
        showRedlineToggle={status.kind === 'analyzed'}
        onUpload={async (file) => {
          await handleBytes(await readFileBytes(file), file.name);
        }}
        onTrySample={() => void onTrySample()}
        onViewChange={(next) => setView(next)}
      />

      <div
        role="tabpanel"
        id="viewmode-panel-portfolio"
        aria-labelledby="viewmode-tab-portfolio"
        hidden={view !== 'portfolio'}
      >
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
            <StandardSuitePanel
              standards={standardSuite}
              onDelete={(id) => {
                void (async (): Promise<void> => {
                  await deleteStandard(id);
                  await refreshStandardSuite();
                  void refreshAuditLog();
                })();
              }}
            />
          </>
        )}
      </div>

      <div
        role="tabpanel"
        id="viewmode-panel-redline"
        aria-labelledby="viewmode-tab-redline"
        hidden={view !== 'redline'}
      >
        {view === 'redline' && status.kind === 'analyzed' && (
          <Suspense fallback={null}>
            <AppRedlinePane
              doc={status.result.doc}
              leaseName={status.fileName}
              redline={redline}
              versionHistory={versionHistory}
              sideLetter={sideLetter}
              sectionForParagraph={sectionForParagraph}
              safeAudit={safeAudit}
            />
          </Suspense>
        )}
      </div>

      <div
        role="tabpanel"
        id="viewmode-panel-current"
        aria-labelledby="viewmode-tab-current"
        hidden={view !== 'current'}
      >
        {view === 'current' && status.kind === 'loading' && (
          <p role="status" aria-live="polite">
            Analyzing {status.fileName}…
          </p>
        )}
        {view === 'current' && status.kind === 'error' && (
          <p role="alert">Could not analyze this file: {status.message}</p>
        )}
        {view === 'current' && status.kind === 'analyzed' && (
          <AppCurrentPane
            status={status}
            selected={selected}
            selectedPage={selectedPage}
            setSelected={setSelected}
            setSelectedPage={setSelectedPage}
            ocrState={ocrState}
            ocrLanguage={ocrLanguage}
            setOcrLanguage={setOcrLanguage}
            ocrLanguages={ocrLanguages}
            hasSigningKey={signingKey.publicKey !== null}
            glossaryEntries={glossaryEntries}
            templates={templates}
            plainEnglishByRuleId={plainEnglishByRuleId}
            suggestedTextByRuleId={suggestedTextByRuleId}
            suggestedEditByRuleId={suggestedEditByRuleId}
            redline={redline}
            counters={counters}
            annotationsApi={annotationsApi}
            analyzedLeaseId={analyzedLeaseId}
            onExportJson={onExportJson}
            onExportSignedJson={() => void onExportSignedJson()}
            onBuildIcs={onBuildIcs}
            onAttemptOcr={() => {
              setSelected(null);
              void pipeline.ocr(ocrLanguage);
            }}
            onPromoteToStandard={(leaseId, paragraphIndex) => {
              if (status.kind !== 'analyzed') return;
              void (async (): Promise<void> => {
                const text = status.result.doc.paragraphs[paragraphIndex]?.text ?? '';
                const name = text.slice(0, 60).trim() || `Clause from ${leaseId}`;
                await promoteToStandard({
                  name,
                  sourceLeaseId: leaseId,
                  sourceParagraphIndex: paragraphIndex,
                  normalizedText: text,
                });
                await refreshStandardSuite();
                void refreshAuditLog();
              })();
            }}
            setView={setView}
          />
        )}
      </div>

      <AppLibraryAndPacksPane
        library={library}
        standardId={standardId}
        templates={templates}
        packs={packs}
        marketplace={{
          loadManifest: loadCuratedManifest,
          onInstall: async (entry: CuratedPackEntry) => {
            const res = await fetch(entry.path);
            if (!res.ok) throw new Error(`Failed to load curated pack: HTTP ${res.status}`);
            const text = await res.text();
            const parsed: unknown = JSON.parse(text);
            let signature: 'verified' | 'invalid' = 'verified';
            if (
              parsed !== null &&
              typeof parsed === 'object' &&
              'algorithm' in parsed &&
              'payload' in parsed &&
              'signature' in parsed
            ) {
              const v = await verifySignedPack(parsed);
              signature = v.ok ? 'verified' : 'invalid';
            }
            const file = new File([text], `${entry.id}.lgpack.json`, {
              type: 'application/json',
            });
            await packs.importPackFile(file);
            return { ok: true, signature };
          },
          onPreviewDiff: async (entry: CuratedPackEntry) => {
            const res = await fetch(entry.path);
            if (!res.ok) throw new Error(`Failed to load curated pack: HTTP ${res.status}`);
            const parsed: unknown = await res.json();
            let candidate: unknown = parsed;
            if (
              parsed !== null &&
              typeof parsed === 'object' &&
              'algorithm' in parsed &&
              'payload' in parsed &&
              'signature' in parsed
            ) {
              const v = await verifySignedPack(parsed);
              if (v.ok && v.pack) candidate = v.pack;
              else throw new Error(`Invalid signed pack: ${v.reason ?? 'unknown'}`);
            }
            const result = validatePackFile(candidate);
            if (!result.ok) throw new Error(`Invalid pack: ${result.errors.join('; ')}`);
            const d = diffPack(packs.activeRules, result.pack);
            return {
              added: d.added.map((r) => r.id),
              removed: d.removed.map((r) => r.id),
              changed: d.changed.map((c) => c.ruleId),
            };
          },
        }}
        jurisdictionOptions={JURISDICTION_OPTIONS}
        severityOverridesPanelRows={packs.activeRules.map((r) => ({
          id: r.id,
          title: r.title,
          severity: severityToOverrideSeverity(r.severity),
        }))}
        severityOverridesPanelMap={overridesToPanel(packs.severityOverrides)}
        severityOverridesPanelOnChange={(ruleId, sev) =>
          void packs.setSeverityOverride(ruleId, sev)
        }
        customRuleBuilderDoc={status.kind === 'analyzed' ? status.result.doc : null}
        auditEntries={auditEntries}
        auditVerification={auditVerification}
        signingKey={signingKey}
        comparison={comparison}
        onOpenLibrary={(id) => void onOpenLibrary(id)}
        onDeleteLibrary={(id) => void onDeleteLibrary(id)}
        onSetStandard={(id) => void setStandardId(id).then(refreshLibrary)}
        onRenameLibrary={(id, name) => void renameLease(id, name).then(refreshLibrary)}
        onCompare={(a, b) => void onCompare(a, b)}
        onSaveTemplate={(input) => void saveTemplate(input).then(refreshTemplates)}
        onUpdateTemplate={(id, patch) => void updateTemplate(id, patch).then(refreshTemplates)}
        onDeleteTemplate={(id) => void deleteTemplate(id).then(refreshTemplates)}
        onRefreshAuditLog={() => void refreshAuditLog()}
        onVerifyAuditChain={() => {
          void (async (): Promise<void> => {
            setAuditVerification(await verifyAuditChain());
          })();
        }}
        onDownloadAuditLog={(entries, verification) => {
          const json = buildAuditLogJson(entries, verification);
          downloadAuditLogBlob(
            json,
            `leaseguard-audit-${new Date().toISOString().slice(0, 10)}.json`,
          );
        }}
      />

      <div
        role="tabpanel"
        id="viewmode-panel-settings"
        aria-labelledby="viewmode-tab-settings"
        hidden={view !== 'settings'}
      >
        {view === 'settings' && (
          <AppSettingsPane
            onExportArchive={() => void exportEncryptedArchiveFlow()}
            onImportArchive={(e) => void onImportArchiveFile(e)}
            onClearAll={() => {
              void clearAllFlow({
                onCleared: async () => {
                  await refreshLibrary();
                  await refreshTemplates();
                  pipeline.reset();
                  setSelected(null);
                },
              });
            }}
          />
        )}
      </div>
    </main>
  );
}
