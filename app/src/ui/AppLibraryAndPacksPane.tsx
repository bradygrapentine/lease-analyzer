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
import { JurisdictionPickerPanel } from './JurisdictionPickerPanel';
import { SeverityOverridesPanel } from './SeverityOverridesPanel';
import { PackDiffPanel } from './PackDiffPanel';
import { BulkImportPanel } from './BulkImportPanel';
import { AuditLogPanel } from './AuditLogPanel';
import { SigningKeyPanel } from './SigningKeyPanel';
import { ComparePanel } from './ComparePanel';
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
  return (
    <>
      <LibraryPanel
        leases={library}
        standardId={standardId}
        onOpen={onOpenLibrary}
        onDelete={onDeleteLibrary}
        onSetStandard={onSetStandard}
        onRename={onRenameLibrary}
      />
      <LibraryCompareForm leases={library} onCompare={onCompare} />
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
      <details>
        <summary>Custom rule builder</summary>
        <CustomRuleBuilderPanel
          doc={customRuleBuilderDoc}
          existingRuleIds={packs.existingRuleIds}
          onSave={(rule) => void packs.saveCustomRule(rule)}
        />
      </details>
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
      <section aria-label="diff rule pack">
        <h2>Diff rule pack</h2>
        <p>
          Load a <code>.lgpack.json</code> file to see how it differs from the currently active rule
          set. Nothing is saved until you import it via the pack manager above.
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
        onRefresh={onRefreshAuditLog}
        onVerify={onVerifyAuditChain}
        onDownload={() => onDownloadAuditLog(auditEntries, auditVerification)}
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
    </>
  );
}
