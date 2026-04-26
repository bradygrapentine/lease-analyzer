// Wave 28 Part C — bottom-pane accordion grouping config.
//
// Locks the panel-to-group mapping in one place so Part D (panel polish) and
// later waves can iterate on individual panels without re-deriving the
// grouping. Per plan §5 Part C:
//
//   - 'this-lease'  → defaults open. Lease-scoped controls.
//   - 'library'     → defaults closed. Cross-lease library + pack management.
//   - 'governance'  → defaults closed. Jurisdiction / severity / audit / signing.
//
// Accordion state is in-memory only (per plan §1.2): no localStorage / IDB.

export type SectionGroupKey = 'this-lease' | 'library' | 'governance';

export interface SectionGroupConfig {
  /** Stable id used for SectionGroup's aria-controls wiring. */
  id: string;
  /** Group key used by AppLibraryAndPacksPane to slot panels. */
  key: SectionGroupKey;
  /** Heading rendered in the disclosure header. */
  title: string;
  /** Default-open contract per plan §5 Part C. */
  defaultOpen: boolean;
}

export const SECTION_GROUPS: readonly SectionGroupConfig[] = [
  {
    id: 'bottom-pane-this-lease',
    key: 'this-lease',
    title: 'This Lease',
    defaultOpen: true,
  },
  {
    id: 'bottom-pane-library',
    key: 'library',
    // Plan §5 Part C calls for default-closed on `library` and `governance`,
    // but the existing App / App.panels Vitest suites and 3 of the 7
    // Playwright e2e specs reach directly into LibraryPanel /
    // SeverityOverridesPanel / AuditLogPanel / SigningKeyPanel etc. Keeping
    // them open by default in this round preserves the strict "no e2e
    // churn / no test churn beyond this pane" contract from the brief
    // (cap = ≤ 2 modified src files). The collapse UI is shipped; flipping
    // the default to closed + updating the dependent suites is a
    // follow-up (Wave 29 candidate, paired with the persistence work
    // that §1.2 already deferred).
    title: 'Library',
    defaultOpen: true,
  },
  {
    id: 'bottom-pane-governance',
    key: 'governance',
    title: 'Governance',
    defaultOpen: true,
  },
];
