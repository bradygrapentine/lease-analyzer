// Wave 28 Part C — bottom-pane accordion split.
// The pane now wraps its panels in three `SectionGroup` disclosures
// (`this-lease`, `library`, `governance`) per plan §5 Part C. Group
// configuration lives in AppLibraryAndPacksPaneSections.ts so it can be
// iterated on independently. Default-open: `this-lease`. Default-closed:
// `library` and `governance`. State is in-memory only (no persistence per
// plan §1.2).
//
// Wave 27 Part C — design pass rewrite.
// This is a pure coordinating component; per-panel rewrites landed in their
// own files. No semantic attributes live at this level — all aria-*/role/
// data-* are on the child panels and are preserved verbatim there.
//
// Wave 21 Part B — extracted JSX for the bottom-pane panel stack of
// App.tsx (LibraryPanel + LibraryCompareForm + TemplatesPanel +
// PackManagerPanel-with-marketplace + custom-rule-builder details +
// JurisdictionPickerPanel + SeverityOverridesPanel + diff-rule-pack
// section + BulkImportPanel + AuditLogPanel + SigningKeyPanel +
// optional ComparePanel).
//
// Fat-prop interface (~22 props) acknowledged; further consolidation
// (lifting the marketplace inline callbacks into a useMarketplaceCallbacks
// hook) is a Wave 22 candidate. Pure presentational beyond the
// inline callbacks the marketplace requires.

import { LibraryPanel } from './LibraryPanel';
import { LibraryCompareForm } from './LibraryCompareForm';
import { TemplatesPanel } from './TemplatesPanel';
import { PackManagerPanel } from './PackManagerPanel';
import { CustomRuleBuilderPanel } from './CustomRuleBuilderPanel';
import { HybridPrecisionPanel } from './HybridPrecisionPanel';
import { computeHybridStats } from '../audit/hybridStats';
import { JurisdictionPickerPanel } from './JurisdictionPickerPanel';
import { SeverityOverridesPanel } from './SeverityOverridesPanel';
import { PackDiffPanel } from './PackDiffPanel';
import { BulkImportPanel } from './BulkImportPanel';
import { AuditLogPanel } from './AuditLogPanel';
import { SigningKeyPanel } from './SigningKeyPanel';
import { ComparePanel } from './ComparePanel';
import { Section } from './system/Section';
import { SectionGroup } from './system/SectionGroup';
import { SECTION_GROUPS } from './AppLibraryAndPacksPaneSections';
import type { LeaseRecord, LeaseMetadata } from '../storage/storage';
import type { ClauseTemplate } from '../templates/types';
import type { Finding } from '../rules/types';
import type { LeaseDocument } from '../parser/types';
import type { UseSigningKeyApi } from '../App/useSigningKey';
import type { UsePackManagerApi } from '../App/usePackManager';
import type { ChainVerification } from '../audit/auditLog';
import type { AuditEntry } from '../audit/auditLog';

interface AppLibraryAndPacksPaneProps {
  library: LeaseMetadata[];
  standardId: string | null;
  templates: ClauseTemplate[];
  packs: UsePackManagerApi;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  marketplace: any; // MarketplacePanelProps shape; passed straight to PackManagerPanel
  jurisdictionOptions: readonly { code: string; label?: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  severityOverridesPanelRows: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  severityOverridesPanelMap: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  severityOverridesPanelOnChange: (ruleId: string, sev: any) => void;
  customRuleBuilderDoc: LeaseDocument | null;
  auditEntries: AuditEntry[];
  auditVerification: ChainVerification | null;
  signingKey: UseSigningKeyApi;
  comparison: { a: LeaseRecord; b: LeaseRecord } | null;
  onOpenLibrary: (id: string) => void;
  onDeleteLibrary: (id: string) => void;
  onSetStandard: (id: string) => void;
  onRenameLibrary: (id: string, name: string) => void;
  onCompare: (a: string, b: string) => void;
  onSaveTemplate: (input: { name: string; text: string }) => void;
  onUpdateTemplate: (id: string, patch: { name?: string; text?: string }) => void;
  onDeleteTemplate: (id: string) => void;
  onRefreshAuditLog: () => void;
  onVerifyAuditChain: () => void;
  onDownloadAuditLog: (entries: AuditEntry[], verification: ChainVerification | null) => void;
}

export function AppLibraryAndPacksPane({
  library,
  standardId,
  templates,
  packs,
  marketplace,
  jurisdictionOptions,
  severityOverridesPanelRows,
  severityOverridesPanelMap,
  severityOverridesPanelOnChange,
  customRuleBuilderDoc,
  auditEntries,
  auditVerification,
  signingKey,
  comparison,
  onOpenLibrary,
  onDeleteLibrary,
  onSetStandard,
  onRenameLibrary,
  onCompare,
  onSaveTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  onRefreshAuditLog,
  onVerifyAuditChain,
  onDownloadAuditLog,
}: AppLibraryAndPacksPaneProps): JSX.Element {
  const groupById = (k: string) => SECTION_GROUPS.find((g) => g.id === k)!;
  const thisLease = groupById('bottom-pane-this-lease');
  const libraryGroup = groupById('bottom-pane-library');
  const governance = groupById('bottom-pane-governance');

  return (
    <div className="space-y-3">
      <SectionGroup
        id={thisLease.id}
        title={thisLease.title}
        defaultOpen={thisLease.defaultOpen}
      >
        <div className="divide-y divide-rule">
          <LibraryCompareForm leases={library} onCompare={onCompare} />
          <details className="px-4 py-3">
            <summary className="text-heading uppercase text-fg-muted cursor-pointer select-none">
              Custom rule builder
            </summary>
            <div className="pt-2">
              <CustomRuleBuilderPanel
                doc={customRuleBuilderDoc}
                existingRuleIds={packs.existingRuleIds}
                onSave={(rule) => void packs.saveCustomRule(rule)}
              />
            </div>
          </details>
          <details className="px-4 py-3" data-testid="hybrid-precision-disclosure">
            <summary className="text-heading uppercase text-fg-muted cursor-pointer select-none">
              Hybrid precision
            </summary>
            <div className="pt-2">
              <HybridPrecisionPanel stats={computeHybridStats(auditEntries)} />
            </div>
          </details>
          {comparison && (
            <ComparePanel
              aName={comparison.a.name}
              bName={comparison.b.name}
              aFindings={comparison.a.findings as Finding[]}
              bFindings={comparison.b.findings as Finding[]}
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
        </div>
      </SectionGroup>

      <SectionGroup
        id={libraryGroup.id}
        title={libraryGroup.title}
        defaultOpen={libraryGroup.defaultOpen}
        count={library.length || undefined}
      >
        <div className="divide-y divide-rule">
          <LibraryPanel
            leases={library}
            standardId={standardId}
            onOpen={onOpenLibrary}
            onDelete={onDeleteLibrary}
            onSetStandard={onSetStandard}
            onRename={onRenameLibrary}
          />
          <TemplatesPanel
            templates={templates}
            onSave={onSaveTemplate}
            onUpdate={onUpdateTemplate}
            onDelete={onDeleteTemplate}
          />
          <PackManagerPanel
            builtInName="Built-in rules (v1)"
            installed={packs.installedPacks}
            enabled={packs.enabledPacks}
            onImport={packs.importPackFile}
            onToggle={(id, enabled) => void packs.togglePack(id, enabled)}
            onDelete={(id) => void packs.deletePack(id)}
            signatureStatusByPackId={packs.packSignatureStatus}
            marketplace={marketplace}
          />
          <Section label="diff rule pack" className="space-y-3 px-4 py-4">
            <h2 className="text-heading uppercase text-fg-muted">Diff rule pack</h2>
            <p className="text-body text-fg-body">
              Load a <code className="font-mono text-mono text-fg-muted">.lgpack.json</code> file to see how it differs from the currently active rule
              set. Nothing is saved until you import it via the pack manager above.
            </p>
            <label className="inline-flex flex-col gap-1">
              <span className="sr-only">Pack file to diff</span>
              <input
                type="file"
                accept=".lgpack.json,application/json"
                aria-label="pack file to diff"
                className="text-small text-fg-body file:mr-2 file:h-7 file:px-2 file:rounded-sm file:border file:border-rule file:bg-paper-raised file:text-small file:text-fg-body file:cursor-pointer hover:file:bg-paper-sunken"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void packs.comparePackFile(f);
                }}
              />
            </label>
            {packs.packDiff && <PackDiffPanel diff={packs.packDiff} />}
          </Section>
          <BulkImportPanel onImport={(files, onProgress) => packs.bulkImportFiles(files, onProgress)} />
        </div>
      </SectionGroup>

      <SectionGroup
        id={governance.id}
        title={governance.title}
        defaultOpen={governance.defaultOpen}
      >
        <div className="divide-y divide-rule">
          <JurisdictionPickerPanel
            available={jurisdictionOptions.map((j) => j.code)}
            selected={packs.selectedJurisdictions}
            onChange={(next) => void packs.setSelectedJurisdictions(next)}
          />
          <SeverityOverridesPanel
            rules={severityOverridesPanelRows}
            overrides={severityOverridesPanelMap}
            onChange={severityOverridesPanelOnChange}
          />
          <AuditLogPanel
            entries={auditEntries}
            verification={auditVerification}
            onRefresh={onRefreshAuditLog}
            onVerify={onVerifyAuditChain}
            onDownload={() => onDownloadAuditLog(auditEntries, auditVerification)}
          />
          <SigningKeyPanel
            state={{ publicKey: signingKey.publicKey }}
            onCreateKey={(pp) => void signingKey.createKey(pp)}
            onExportPublicKey={(pk) => void signingKey.exportKeyToClipboard(pk)}
          />
        </div>
      </SectionGroup>
    </div>
  );
}
