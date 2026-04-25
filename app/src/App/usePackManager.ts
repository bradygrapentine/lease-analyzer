import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteInstalledPack,
  getPackEnabled,
  getPackSignatureStatus,
  getSelectedJurisdictions,
  getSeverityOverrides,
  listInstalledPacks,
  saveInstalledPack,
  saveSignedPack,
  setPackEnabled,
  setSelectedJurisdictions,
  setSeverityOverride,
  type PackSignatureStatus,
} from '../rules/packStorage';
import { resolveActiveRules } from '../rules/activePack';
import { RULE_PACK_V1 } from '../rules/packV1';
import { analyzeFile } from '../ui/analyzeFile';
import { saveLease } from '../storage/storage';
import {
  bulkImport,
  type BulkResult,
  type BulkSummary,
} from '../workflow/bulkImport';
import { applySeverityOverrides } from '../rules/severityOverrides';
import { filterByJurisdiction } from '../rules/jurisdictions';
import {
  RULE_PACK_SCHEMA_VERSION,
  validatePackFile,
  type RulePackFile,
} from '../rules/packSchema';
import { verifySignedPack, type SignedPackEnvelope } from '../rules/packSigning';
import { diffPack, type PackDiff } from '../rules/packDiff';
import { overrideToSeverity } from '../ui/severityMap';
import type { OverrideSeverity } from '../ui/SeverityOverridesPanel';
import type { PackSignatureBadge } from '../ui/PackManagerPanel';
import type { Rule, Severity } from '../rules/types';

export interface UsePackManagerDeps {
  audit?: (input: { kind: string; payload: Record<string, unknown> }) => Promise<void>;
  onAuditMutation?: () => void;
  onError?: (msg: string) => void;
  /** Called after a bulk import so the library panel can refresh. */
  onBulkImportComplete?: () => void | Promise<void>;
}

export interface UsePackManagerApi {
  installedPacks: RulePackFile[];
  enabledPacks: Set<string>;
  selectedJurisdictions: string[];
  severityOverrides: Record<string, Severity>;
  packDiff: PackDiff | null;
  packSignatureStatus: Record<string, PackSignatureBadge>;
  /** Layered rule set: built-in + installed → jurisdictions → severity overrides. */
  activeRules: Rule[];
  /** All rule ids (built-in + installed) for the custom-rule dup-id guard. */
  existingRuleIds: string[];
  refresh: () => Promise<void>;
  importPackFile: (file: File) => Promise<void>;
  togglePack: (id: string, enabled: boolean) => Promise<void>;
  deletePack: (id: string) => Promise<void>;
  saveCustomRule: (rule: Rule) => Promise<void>;
  setSelectedJurisdictions: (next: string[]) => Promise<void>;
  setSeverityOverride: (
    ruleId: string,
    panelSeverity: OverrideSeverity | null,
  ) => Promise<void>;
  comparePackFile: (file: File) => Promise<void>;
  clearPackDiff: () => void;
  /**
   * Analyze + save a batch of PDF files using the current `activeRules`.
   * Surfaces a `bulk-import` audit event on completion. Returns the bulk
   * summary so the caller can render success / skip / error counts.
   */
  bulkImportFiles: (
    files: File[],
    onProgress: (r: BulkResult) => void,
  ) => Promise<BulkSummary>;
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) resolve(new Uint8Array(result));
      else reject(new Error('unexpected FileReader result'));
    };
    reader.onerror = (): void => reject(reader.error ?? new Error('file read failed'));
    reader.readAsArrayBuffer(file);
  });
}

function friendlyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Owns rule-pack installation, jurisdictions, severity overrides, and the
 * derived `activeRules` array. The signed-pack import flow goes through
 * `saveSignedPack` so trust badges are recorded; unsigned packs go through
 * `saveInstalledPack`. Audit writes are best-effort via the injected
 * `audit` dep so failure never blocks an install.
 */
export function usePackManager(deps: UsePackManagerDeps = {}): UsePackManagerApi {
  const { audit, onAuditMutation, onError, onBulkImportComplete } = deps;
  const [installedPacks, setInstalledPacks] = useState<RulePackFile[]>([]);
  const [enabledPacks, setEnabledPacks] = useState<Set<string>>(new Set());
  const [selectedJurisdictions, setSelectedJurisdictionsState] = useState<string[]>(
    [],
  );
  const [severityOverrides, setSeverityOverridesState] = useState<
    Record<string, Severity>
  >({});
  const [packDiff, setPackDiff] = useState<PackDiff | null>(null);
  const [packSignatureStatus, setPackSignatureStatus] = useState<
    Record<string, PackSignatureBadge>
  >({});

  const refresh = useCallback(async (): Promise<void> => {
    const packs = await listInstalledPacks();
    const enabled = new Set<string>();
    const sigStatus: Record<string, PackSignatureBadge> = {};
    for (const p of packs) {
      if (await getPackEnabled(p.id)) enabled.add(p.id);
      const status: PackSignatureStatus = await getPackSignatureStatus(p.id);
      sigStatus[p.id] =
        status === 'verified'
          ? 'verified'
          : status === 'invalid'
            ? 'invalid'
            : status === 'unknown'
              ? 'unknown'
              : 'community';
    }
    setInstalledPacks(packs);
    setEnabledPacks(enabled);
    setPackSignatureStatus(sigStatus);
    const [j, ov] = await Promise.all([
      getSelectedJurisdictions(),
      getSeverityOverrides(),
    ]);
    setSelectedJurisdictionsState(j);
    setSeverityOverridesState(ov);
  }, []);

  // Memoize the resolved-rules base so `activeRules`'s identity is stable
  // across unrelated re-renders. Without this, every render produces a new
  // base array and any downstream `[activeRules]` effect would loop.
  const baseResolvedRules = useMemo(
    () => resolveActiveRules(RULE_PACK_V1, installedPacks, enabledPacks).rules,
    [installedPacks, enabledPacks],
  );

  const activeRules = useMemo(
    () =>
      applySeverityOverrides(
        filterByJurisdiction(baseResolvedRules, selectedJurisdictions),
        severityOverrides,
      ),
    [baseResolvedRules, selectedJurisdictions, severityOverrides],
  );

  const existingRuleIds = useMemo<string[]>(() => {
    const ids = new Set<string>();
    for (const r of RULE_PACK_V1) ids.add(r.id);
    for (const pack of installedPacks) for (const r of pack.rules) ids.add(r.id);
    return Array.from(ids);
  }, [installedPacks]);

  const importPackFile = useCallback<UsePackManagerApi['importPackFile']>(
    async (file) => {
      const bytes = await readFileBytes(file);
      const text = new TextDecoder().decode(bytes);
      const parsed: unknown = JSON.parse(text);

      if (
        parsed !== null &&
        typeof parsed === 'object' &&
        'algorithm' in parsed &&
        'payload' in parsed &&
        'signature' in parsed
      ) {
        const verify = await verifySignedPack(parsed);
        if (!verify.ok || !verify.pack) {
          if (audit) {
            await audit({
              kind: 'pack-signature-invalid',
              payload: { reason: verify.reason ?? 'unknown' },
            });
          }
          onAuditMutation?.();
          throw new Error(`Invalid signed pack: ${verify.reason ?? 'unknown'}`);
        }
        await saveSignedPack(parsed as SignedPackEnvelope, verify.pack);
        await setPackEnabled(verify.pack.id, true);
        if (audit) {
          await audit({
            kind: 'pack-signature-verified',
            payload: { packId: verify.pack.id, version: verify.pack.version },
          });
          await audit({
            kind: 'import-pack',
            payload: {
              packId: verify.pack.id,
              version: verify.pack.version,
              signed: true,
            },
          });
        }
        await refresh();
        onAuditMutation?.();
        return;
      }

      const result = validatePackFile(parsed);
      if (!result.ok) {
        throw new Error(`Invalid pack: ${result.errors.join('; ')}`);
      }
      await saveInstalledPack(result.pack);
      await setPackEnabled(result.pack.id, true);
      if (audit) {
        await audit({
          kind: 'import-pack',
          payload: { packId: result.pack.id, version: result.pack.version },
        });
      }
      await refresh();
      onAuditMutation?.();
    },
    [audit, onAuditMutation, refresh],
  );

  const togglePack = useCallback<UsePackManagerApi['togglePack']>(
    async (id, enabled) => {
      await setPackEnabled(id, enabled);
      await refresh();
    },
    [refresh],
  );

  const deletePack = useCallback<UsePackManagerApi['deletePack']>(
    async (id) => {
      await deleteInstalledPack(id);
      await refresh();
    },
    [refresh],
  );

  const saveCustomRule = useCallback<UsePackManagerApi['saveCustomRule']>(
    async (rule) => {
      const pack: RulePackFile = {
        schema: RULE_PACK_SCHEMA_VERSION,
        id: `custom-${rule.id}`,
        name: `Custom: ${rule.title}`,
        version: '1.0.0',
        description: `User-authored rule "${rule.id}" from the custom rule builder.`,
        rules: [rule],
      };
      await saveInstalledPack(pack);
      await setPackEnabled(pack.id, true);
      if (audit) {
        await audit({
          kind: 'custom-rule-save',
          payload: { ruleId: rule.id, packId: pack.id },
        });
      }
      await refresh();
      onAuditMutation?.();
    },
    [audit, onAuditMutation, refresh],
  );

  const setSelectedJurisdictionsApi = useCallback<
    UsePackManagerApi['setSelectedJurisdictions']
  >(async (next) => {
    setSelectedJurisdictionsState(next);
    await setSelectedJurisdictions(next);
  }, []);

  const setSeverityOverrideApi = useCallback<UsePackManagerApi['setSeverityOverride']>(
    async (ruleId, panelSeverity) => {
      setSeverityOverridesState((prev) => {
        const next = { ...prev };
        if (panelSeverity === null) {
          delete next[ruleId];
        } else {
          next[ruleId] = overrideToSeverity(panelSeverity);
        }
        return next;
      });
      if (panelSeverity === null) {
        await setSeverityOverride(ruleId, null);
      } else {
        await setSeverityOverride(ruleId, overrideToSeverity(panelSeverity));
      }
    },
    [],
  );

  const comparePackFile = useCallback<UsePackManagerApi['comparePackFile']>(
    async (file) => {
      try {
        const bytes = await readFileBytes(file);
        const text = new TextDecoder().decode(bytes);
        const parsed: unknown = JSON.parse(text);
        const result = validatePackFile(parsed);
        if (!result.ok) {
          onError?.(`Invalid pack: ${result.errors.join('; ')}`);
          return;
        }
        setPackDiff(diffPack(activeRules, result.pack));
      } catch (err) {
        onError?.(`Could not diff pack: ${friendlyError(err)}`);
      }
    },
    [activeRules, onError],
  );

  const clearPackDiff = useCallback(() => setPackDiff(null), []);

  const bulkImportFiles = useCallback<UsePackManagerApi['bulkImportFiles']>(
    async (files, onProgress) => {
      const summary = await bulkImport(files, onProgress, {
        analyze: async (bytes) => {
          const r = await analyzeFile(bytes, activeRules);
          return { doc: r.doc, findings: r.findings };
        },
        save: async (input) => saveLease(input),
      });
      if (audit) {
        await audit({
          kind: 'bulk-import',
          payload: {
            ok: summary.ok,
            skipped: summary.skipped,
            errors: summary.errors,
          },
        });
      }
      if (onBulkImportComplete) await onBulkImportComplete();
      onAuditMutation?.();
      return summary;
    },
    [activeRules, audit, onAuditMutation, onBulkImportComplete],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    installedPacks,
    enabledPacks,
    selectedJurisdictions,
    severityOverrides,
    packDiff,
    packSignatureStatus,
    activeRules,
    existingRuleIds,
    refresh,
    importPackFile,
    togglePack,
    deletePack,
    saveCustomRule,
    setSelectedJurisdictions: setSelectedJurisdictionsApi,
    setSeverityOverride: setSeverityOverrideApi,
    comparePackFile,
    clearPackDiff,
    bulkImportFiles,
  };
}
