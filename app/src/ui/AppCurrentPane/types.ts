// Wave 45-BE — shared prop types for the AppCurrentPane coordinator and
// its extracted regions. Lifted out of AppCurrentPane.tsx to keep the
// coordinator file under the ≤120-line budget set in the wave plan.

import type { Dispatch, SetStateAction } from 'react';
import type { OcrLanguage } from '../../ocr/availableLanguages';
import type { Finding } from '../../rules/types';
import type { LeaseDocument } from '../../parser/types';
import type { ClauseTemplate } from '../../templates/types';
import type { GlossaryEntry } from '../../glossary/loadGlossary';
import type { UseRedlineStateApi } from '../../App/useRedlineState';
import type { UseAnnotationsApi } from '../../App/useAnnotations';
import type { UseCounterOffersApi } from '../../App/useCounterOffers';

export interface AnalyzedStatus {
  kind: 'analyzed';
  fileName: string;
  bytes: Uint8Array | null;
  leaseId: string | null;
  result: {
    doc: LeaseDocument;
    findings: Finding[];
  };
}

export type OcrState =
  | { kind: 'idle' }
  | { kind: 'running'; pct: number; stage: string }
  | { kind: 'error'; message: string };

export interface AppCurrentPaneProps {
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
