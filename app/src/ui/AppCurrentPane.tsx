// Wave 45-BE — Coordinator for analyzed-view IA. Composes the extracted
// regions (ResultsHeader / ScannedPdfNotice / FindingsPanel + PdfViewer
// split / SelectedFindingCard / SupportingContext). Aria inventory
// preserved verbatim and asserted by the BE-1.4 inventory test.
import { lazy, Suspense, useMemo, useState } from 'react';
import { FindingsPanel } from './FindingsPanel';
import { PdfViewer } from './PdfViewer';
import { ResultsHeader } from './AppCurrentPane/ResultsHeader';
import { ScannedPdfNotice } from './AppCurrentPane/ScannedPdfNotice';
import { SupportingContext } from './AppCurrentPane/SupportingContext';
import { extractLeaseFacts } from '../facts/extractFacts';
import { needsOcr } from '../compare/needsOcr';
import { exportFindingsAsHtml } from '../App/appHelpers';
import type { AppCurrentPaneProps } from './AppCurrentPane/types';
import { FindingRail } from './FindingRail';
import { ReaderPdfToggle, type ReaderPdfMode } from './ReaderPdfToggle';
import { FindingDetailModal } from './FindingDetailModal';

// Wave 51-C — MarginaliaReader is the new default reading surface but
// includes glossary + paragraph rendering bulk; lazy-load to keep the app
// shell lean. PDF mode keeps the eager `PdfViewer` import (it owns the
// pdf.js client which is already a separate chunk).
const MarginaliaReader = lazy(() =>
  import('./MarginaliaReader').then((m) => ({ default: m.MarginaliaReader })),
);

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
  // Per-session document-view mode. Marginalia reader is default; PDF is one
  // click away. State stays in component memory — see plan §1.9.
  // Scanned / OCR-poor leases default to PDF — the reader has no
  // extractable text to render in that case, so showing the PDF first
  // is the only trustworthy representation until OCR runs.
  const [docMode, setDocMode] = useState<ReaderPdfMode>(ocr ? 'pdf' : 'reader');
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
      <div className="flex justify-end px-2 pb-1">
        <ReaderPdfToggle mode={docMode} onChange={setDocMode} />
      </div>
      <div className="split flex">
        <FindingRail
          paragraphCount={status.result.doc.paragraphs.length}
          findings={status.result.findings}
          selected={selected}
          onSelectFinding={(f) => {
            setSelected(f);
            setSelectedPage(f.page);
          }}
        />
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
          onApplySuggestion={(finding, paragraphIndex, suggestedText) => {
            if (!status.leaseId) return;
            void redline
              .applySuggestion({ finding, paragraphIndex, suggestedText, doc: status.result.doc })
              .then(() => setView('redline'));
          }}
          onPromoteToStandard={onPromoteToStandard}
        />
        {docMode === 'reader' ? (
          <Suspense fallback={null}>
            <MarginaliaReader
              doc={status.result.doc}
              findings={status.result.findings}
              selected={selected}
              onSelectFinding={(f) => {
                setSelected(f);
                setSelectedPage(f.page);
              }}
              fileName={status.fileName}
            />
          </Suspense>
        ) : (
          <PdfViewer
            bytes={status.bytes}
            pageCount={status.result.doc.pages.length}
            selectedPage={selectedPage}
            pages={status.result.doc.pages}
            highlight={
              selected
                ? (status.result.doc.paragraphs[selected.paragraphIndex]?.bbox ?? null)
                : null
            }
            selectedParagraph={
              selected ? (status.result.doc.paragraphs[selected.paragraphIndex] ?? null) : null
            }
            selectedFinding={selected}
          />
        )}
      </div>
      <FindingDetailModal
        open={selected !== null}
        doc={status.result.doc}
        finding={selected}
        allFindings={status.result.findings}
        onSelect={(f) => {
          setSelected(f);
          setSelectedPage(f.page);
        }}
        onClose={() => setSelected(null)}
        suggestedTextByRuleId={suggestedTextByRuleId}
        plainEnglishByRuleId={plainEnglishByRuleId}
        onApplySuggestion={(finding, paragraphIndex, suggestedText) => {
          if (!status.leaseId) return;
          void redline
            .applySuggestion({ finding, paragraphIndex, suggestedText, doc: status.result.doc })
            .then(() => setView('redline'));
        }}
        onAddToCounters={(finding) => {
          const text = suggestedTextByRuleId?.[finding.ruleId] ?? '';
          if (!text) return;
          void counters.save(finding.ruleId, finding.title, text);
        }}
      />

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
