// Wave 45-BE — Coordinator for analyzed-view IA. Composes the extracted
// regions (ResultsHeader / ScannedPdfNotice / FindingsPanel + PdfViewer
// split / SelectedFindingCard / SupportingContext). Aria inventory
// preserved verbatim and asserted by the BE-1.4 inventory test.
import { useMemo } from 'react';
import { FindingsPanel } from './FindingsPanel';
import { PdfViewer } from './PdfViewer';
import { ResultsHeader } from './AppCurrentPane/ResultsHeader';
import { ScannedPdfNotice } from './AppCurrentPane/ScannedPdfNotice';
import { SupportingContext } from './AppCurrentPane/SupportingContext';
import { extractLeaseFacts } from '../facts/extractFacts';
import { needsOcr } from '../compare/needsOcr';
import { exportFindingsAsHtml } from '../App/appHelpers';
import { SelectedFindingCard } from './AppCurrentPane/SelectedFindingCard';
import type { AppCurrentPaneProps } from './AppCurrentPane/types';

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
          onApplySuggestion={(finding, paragraphIndex, suggestedText) => {
            if (!status.leaseId) return;
            void redline
              .applySuggestion({ finding, paragraphIndex, suggestedText, doc: status.result.doc })
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
      {selected && <SelectedFindingCard finding={selected} />}
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
