// Wave 20 Part B — extracted JSX for the `view === 'current' &&
// status.kind === 'analyzed'` block of App.tsx. Pure presentational
// (no IDB / audit imports beyond the helpers needed to compute
// derived data inline). Prop count is wide (~18) because App's
// state is heavily intertwined with this view; further consolidation
// (lifting the inline `extractLeaseFacts` / `matchTemplates` /
// `needsOcr` derivations into a dedicated hook) is a Wave 21
// candidate.

// Aria/data inventory (preserved verbatim):
//   role="status" + className="ocr-banner" (div)
//   aria-live="polite" + className="ocr-progress" (p)
//   role="alert" (p)
//   aria-label="selected finding" (article — now Card as="article")

import { useMemo, type Dispatch, type SetStateAction } from 'react';
import type { OcrLanguage } from '../ocr/availableLanguages';
import { FindingsPanel } from './FindingsPanel';
import { PdfViewer } from './PdfViewer';
import { ResultsHeader } from './AppCurrentPane/ResultsHeader';
import { ScannedPdfNotice } from './AppCurrentPane/ScannedPdfNotice';
import { SupportingContext } from './AppCurrentPane/SupportingContext';
import { extractLeaseFacts } from '../facts/extractFacts';
import { needsOcr } from '../compare/needsOcr';
import { exportFindingsAsHtml } from '../App/appHelpers';
import { Card } from './system/Card';
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
  const ocr = needsOcr(status.result.doc);
  const leaseFacts = useMemo(() => extractLeaseFacts(status.result.doc), [status]);
  return (
    <div className="results">
      <ResultsHeader
        hasSigningKey={hasSigningKey}
        onExportJson={onExportJson}
        onExportSignedJson={onExportSignedJson}
        onExportHtml={() =>
          exportFindingsAsHtml({
            fileName: status.fileName,
            doc: status.result.doc,
            findings: status.result.findings,
          })
        }
      />

      <ScannedPdfNotice
        ocr={ocr}
        ocrState={ocrState}
        ocrLanguage={ocrLanguage}
        ocrLanguages={ocrLanguages}
        setOcrLanguage={setOcrLanguage}
        hasBytes={status.bytes !== null}
        onAttemptOcr={onAttemptOcr}
      />
      <div className="split">
        <FindingsPanel
          findings={status.result.findings}
          onSelect={(f) => {
            setSelected(f);
            setSelectedPage(f.page);
          }}
          definitions={leaseFacts.definitions}
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
          selectedParagraph={
            selected ? (status.result.doc.paragraphs[selected.paragraphIndex] ?? null) : null
          }
          selectedFinding={selected}
        />
      </div>
      {selected && (
        <Card as="article" aria-label="selected finding" className="p-4 space-y-2 my-3">
          <h3 className="text-heading uppercase text-fg-muted">{selected.title}</h3>
          <p className="text-body text-fg-body">{selected.explanation}</p>
          <blockquote className="border-l border-rule pl-3 font-mono text-mono text-fg-muted italic">
            {selected.snippet}
          </blockquote>
          <span className="text-small text-fg-muted">Page {selected.page}</span>
        </Card>
      )}
      <SupportingContext
        status={status}
        selected={selected}
        analyzedLeaseId={analyzedLeaseId}
        annotationsApi={annotationsApi}
        counters={counters}
        templates={templates}
        leaseFacts={leaseFacts}
        suggestedEditByRuleId={suggestedEditByRuleId}
        onBuildIcs={onBuildIcs}
      />
    </div>
  );
}
