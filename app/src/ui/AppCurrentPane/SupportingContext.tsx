// Wave 45-BE — extracted from AppCurrentPane.tsx (lines 234-275). The
// post-findings supporting region: annotations + counter-offer + template
// matches + lease facts + workflow, in fixed order. None of these are
// the renter's first decision; grouping under one named region clarifies
// the IA (priority above the split, supporting context here).

import { matchTemplates } from '../../templates/matchTemplates';
import { buildSummary, copyToClipboard } from '../../workflow/copySummary';
import { downloadHandoffZip } from '../../App/appHelpers';
import { AnnotationsPanel } from '../AnnotationsPanel';
import { CounterOfferPanel } from '../CounterOfferPanel';
import { TemplateMatchesPanel } from '../TemplateMatchesPanel';
import { LeaseFactsPanel } from '../LeaseFactsPanel';
import { WorkflowPanel } from '../WorkflowPanel';
import type { Finding } from '../../rules/types';
import type { LeaseDocument } from '../../parser/types';
import type { ClauseTemplate } from '../../templates/types';
import type { LeaseFacts } from '../../facts/types';
import type { UseAnnotationsApi } from '../../App/useAnnotations';
import type { UseCounterOffersApi } from '../../App/useCounterOffers';

interface AnalyzedStatus {
  fileName: string;
  bytes: Uint8Array | null;
  result: {
    doc: LeaseDocument;
    findings: Finding[];
  };
}

export interface SupportingContextProps {
  status: AnalyzedStatus;
  selected: Finding | null;
  analyzedLeaseId: string | null;
  annotationsApi: UseAnnotationsApi;
  counters: UseCounterOffersApi;
  templates: ClauseTemplate[];
  leaseFacts: LeaseFacts;
  suggestedEditByRuleId: Record<string, string>;
  onBuildIcs: () => void;
}

export function SupportingContext({
  status,
  selected,
  analyzedLeaseId,
  annotationsApi,
  counters,
  templates,
  leaseFacts,
  suggestedEditByRuleId,
  onBuildIcs,
}: SupportingContextProps): JSX.Element {
  return (
    <>
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
    </>
  );
}
