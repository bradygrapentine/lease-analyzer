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
import { Card } from './system/Card';
import { Button } from './system/Button';
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
  const leaseFacts = useMemo(() => extractLeaseFacts(status.result.doc), [status]);
  return (
    <div className="results">
      <div className="results-actions flex flex-wrap gap-2 mb-3">
        <Button type="button" variant="subtle" size="sm" onClick={onExportJson}>
          {t('findings.export.json')}
        </Button>
        <Button
          type="button"
          variant="subtle"
          size="sm"
          onClick={() =>
            exportFindingsAsHtml({
              fileName: status.fileName,
              doc: status.result.doc,
              findings: status.result.findings,
            })
          }
        >
          {t('findings.export.html')}
        </Button>
        {hasSigningKey && (
          <Button type="button" variant="subtle" size="sm" onClick={onExportSignedJson}>
            {t('findings.export.signed')}
          </Button>
        )}
      </div>
      {hasSigningKey && (
        <details className="text-small text-fg-muted mb-3">
          <summary className="cursor-pointer select-none">What is signed export?</summary>
          <p className="mt-1 max-w-prose">
            The exported file carries a digital signature made with your local key. To use it as
            proof of origin, share your public key with the recipient out-of-band (use{' '}
            <em>Export public key</em> in the Signing key panel). They compare your public key
            against the key embedded in the signed export. Without that comparison step, the file
            only verifies against its own embedded key, which an attacker could replace.
          </p>
        </details>
      )}
      {ocr.likelyScanned && (
        <div
          role="status"
          className="ocr-banner bg-paper-sunken border border-rule rounded-sm p-3 mb-3 space-y-2"
        >
          <p className="text-body text-fg-body">
            This PDF looks scanned (avg {Math.round(ocr.avgCharsPerPage)} chars/page). Text
            extraction may be incomplete.
          </p>
          {status.bytes && ocrState.kind !== 'running' && (
            <Button type="button" variant="subtle" size="sm" onClick={onAttemptOcr}>
              Attempt OCR
            </Button>
          )}
          <OcrLanguagePickerPanel
            available={ocrLanguages}
            selected={ocrLanguage}
            onChange={setOcrLanguage}
          />
          {ocrState.kind === 'running' && (
            <p aria-live="polite" className="ocr-progress text-body text-fg-body">
              Running OCR: {ocrState.stage} ({Math.round(ocrState.pct * 100)}%)
            </p>
          )}
          {ocrState.kind === 'error' && (
            <p role="alert" className="text-body text-severity-high">
              OCR didn&rsquo;t finish reading this PDF. The error was: {ocrState.message}. Clauses
              on scanned pages may not appear in findings. You can try a different language pack
              from the picker above, or use the original PDF if its text is selectable.
            </p>
          )}
        </div>
      )}
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
      <LeaseFactsPanel facts={leaseFacts} />
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
