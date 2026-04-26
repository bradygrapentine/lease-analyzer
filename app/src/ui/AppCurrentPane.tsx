// Wave 20 Part B — extracted JSX for the `view === 'current' &&
// status.kind === 'analyzed'` block of App.tsx. Pure presentational
// (no IDB / audit imports beyond the helpers needed to compute
// derived data inline). Prop count is wide (~18) because App's
// state is heavily intertwined with this view; further consolidation
// (lifting the inline `extractLeaseFacts` / `matchTemplates` /
// `needsOcr` derivations into a dedicated hook) is a Wave 21
// candidate.

import type { Dispatch, SetStateAction } from 'react';
import type { OcrLanguage } from '../ocr/availableLanguages';
import { FindingsPanel } from './FindingsPanel';
import { PdfViewer } from './PdfViewer';
import { OcrLanguagePickerPanel } from './OcrLanguagePickerPanel';
import { AnnotationsPanel } from './AnnotationsPanel';
import { CounterOfferPanel } from './CounterOfferPanel';
import { TemplateMatchesPanel } from './TemplateMatchesPanel';
import { LeaseFactsPanel } from './LeaseFactsPanel';
import { WorkflowPanel } from './WorkflowPanel';
import { extractLeaseFacts } from '../facts/extractFacts';
import { needsOcr } from '../compare/needsOcr';
import { matchTemplates } from '../templates/matchTemplates';
import { buildSummary, copyToClipboard } from '../workflow/copySummary';
import { exportFindingsAsHtml, downloadHandoffZip } from '../App/appHelpers';
import { useI18n } from '../i18n/I18nContext';
import type { Finding } from '../rules/types';
import type { LeaseDocument } from '../parser/types';
import type { ClauseTemplate } from '../templates/types';
import type { GlossaryEntry } from '../glossary/loadGlossary';
import type { UseRedlineStateApi } from '../App/useRedlineState';
import type { UseAnnotationsApi } from '../App/useAnnotations';
import type { UseCounterOffersApi } from '../App/useCounterOffers';

interface AnalyzedStatus {
  kind: 'analyzed';
  fileName: string;
  bytes: Uint8Array | null;
  leaseId: string | null;
  result: {
    doc: LeaseDocument;
    findings: Finding[];
  };
}

type OcrState =
  | { kind: 'idle' }
  | { kind: 'running'; pct: number; stage: string }
  | { kind: 'error'; message: string };

interface AppCurrentPaneProps {
  status: AnalyzedStatus;
  selected: Finding | null;
  selectedPage: number | null;
  setSelected: Dispatch<SetStateAction<Finding | null>>;
  setSelectedPage: Dispatch<SetStateAction<number | null>>;
  ocrState: OcrState;
  ocrLanguage: string;
  setOcrLanguage: (next: string) => void;
  ocrLanguages: OcrLanguage[];
  hasSigningKey: boolean;
  glossaryEntries: GlossaryEntry[];
  templates: ClauseTemplate[];
  plainEnglishByRuleId: Record<string, string>;
  suggestedTextByRuleId: Record<string, string>;
  suggestedEditByRuleId: Record<string, string>;
  redline: UseRedlineStateApi;
  counters: UseCounterOffersApi;
  annotationsApi: UseAnnotationsApi;
  analyzedLeaseId: string | null;
  onExportJson: () => void;
  onExportSignedJson: () => void;
  onBuildIcs: () => void;
  onAttemptOcr: () => void;
  onPromoteToStandard: (leaseId: string, paragraphIndex: number) => void;
  setView: (view: 'redline') => void;
}

export function AppCurrentPane({
  status,
  selected,
  selectedPage,
  setSelected,
  setSelectedPage,
  ocrState,
  ocrLanguage,
  setOcrLanguage,
  ocrLanguages,
  hasSigningKey,
  glossaryEntries,
  templates,
  plainEnglishByRuleId,
  suggestedTextByRuleId,
  suggestedEditByRuleId,
  redline,
  counters,
  annotationsApi,
  analyzedLeaseId,
  onExportJson,
  onExportSignedJson,
  onBuildIcs,
  onAttemptOcr,
  onPromoteToStandard,
  setView,
}: AppCurrentPaneProps): JSX.Element {
  const { t } = useI18n();
  const ocr = needsOcr(status.result.doc);
  return (
    <div className="results">
      <div className="results-actions">
        <button type="button" onClick={onExportJson}>
          {t('findings.export.json')}
        </button>
        <button
          type="button"
          onClick={() =>
            exportFindingsAsHtml({
              fileName: status.fileName,
              doc: status.result.doc,
              findings: status.result.findings,
            })
          }
        >
          {t('findings.export.html')}
        </button>
        {hasSigningKey && (
          <button type="button" onClick={onExportSignedJson}>
            {t('findings.export.signed')}
          </button>
        )}
      </div>
      {ocr.likelyScanned && (
        <div role="status" className="ocr-banner">
          <p>
            This PDF looks scanned (avg {Math.round(ocr.avgCharsPerPage)} chars/page). Text
            extraction may be incomplete.
          </p>
          {status.bytes && ocrState.kind !== 'running' && (
            <button type="button" onClick={onAttemptOcr}>
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
      )}
      <div className="split">
        <FindingsPanel
          findings={status.result.findings}
          onSelect={(f) => {
            setSelected(f);
            setSelectedPage(f.page);
          }}
          definitions={extractLeaseFacts(status.result.doc).definitions}
          glossary={glossaryEntries}
          plainEnglishByRuleId={plainEnglishByRuleId}
          suggestedTextByRuleId={suggestedTextByRuleId}
          onApplySuggestion={(f, pIdx, text) => {
            if (!status.leaseId) return;
            void redline
              .applySuggestion({
                finding: f,
                paragraphIndex: pIdx,
                suggestedText: text,
                doc: status.result.doc,
              })
              .then(() => setView('redline'));
          }}
          onPromoteToStandard={onPromoteToStandard}
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
          await copyToClipboard(
            buildSummary({ leaseName: status.fileName, findings: status.result.findings }),
          );
        }}
        onDownloadHandoff={() => {
          downloadHandoffZip({
            fileName: status.fileName,
            doc: status.result.doc,
            findings: status.result.findings,
            bytes: status.bytes,
          });
        }}
      />
    </div>
  );
}
