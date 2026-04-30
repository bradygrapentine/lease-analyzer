// Wave 28 Part C — bottom-pane accordion grouping config.
// Wave 30 Part B — flipped all three defaults to closed and wired
// `localStorage` persistence in `SectionGroup`. The `defaultOpen` value
// here is now only consulted on first visit (no storage key set yet);
// once a user toggles a section, the stored `lg.accordion.<id>.open`
// preference wins on subsequent loads. Per plan §1.4 / §5 Part B.
//
// Locks the panel-to-group mapping in one place so Part D (panel polish) and
// later waves can iterate on individual panels without re-deriving the
// grouping. Per plan §5 Part C and §5 Part B:
//
//   - 'this-lease'  → defaults closed. Lease-scoped controls.
//   - 'library'     → defaults closed. Cross-lease library + pack management.
//   - 'governance'  → defaults closed. Jurisdiction / severity / audit / signing.

export type SectionGroupKey = 'this-lease' | 'library' | 'governance';

export interface SectionGroupConfig {
  /** Stable id used for SectionGroup's aria-controls wiring. */
  id: string;
  /** Group key used by AppLibraryAndPacksPane to slot panels. */
  key: SectionGroupKey;
  /** Heading rendered in the disclosure header. */
  title: string;
  /**
   * Default-open contract per plan §5 Part B. Only consulted on first
   * visit (no `lg.accordion.<id>.open` localStorage key set); once a
   * user toggles a section the stored preference wins.
   */
  defaultOpen: boolean;
}

export const SECTION_GROUPS: readonly SectionGroupConfig[] = [
  {
    id: 'bottom-pane-this-lease',
    key: 'this-lease',
    title: 'This lease',
    defaultOpen: false,
  },
  {
    id: 'bottom-pane-library',
    key: 'library',
    title: 'Saved leases & rules',
    defaultOpen: false,
  },
  {
    id: 'bottom-pane-governance',
    key: 'governance',
    title: 'Advanced rule settings',
    defaultOpen: false,
  },
];
