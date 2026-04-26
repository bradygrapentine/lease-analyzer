// Wave 27-C — design pass rewrite.
// Semantic attributes preserved verbatim (e2e critical):
//   aria-label="library"                (section, both branches)
//   aria-label={`Open ${l.name}`}       (button — save-and-library.spec.ts + annotation-flow.spec.ts)
//   aria-label="standard lease"         (span inside open button)
//   aria-label={`Set ${l.name} as standard`} (button)
//   aria-label={`Rename ${l.name}`}     (button)
//   aria-label={`Delete ${l.name}`}     (button)
//
import type { LeaseMetadata } from '../storage/storage';
import { Section } from './system/Section';
import { Button } from './system/Button';

interface LibraryPanelProps {
  leases: LeaseMetadata[];
  standardId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onSetStandard: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export function LibraryPanel({
  leases,
  standardId,
  onOpen,
  onDelete,
  onSetStandard,
  onRename,
}: LibraryPanelProps): JSX.Element {
  if (leases.length === 0) {
    return (
      <Section label="library" className="space-y-2 px-4 py-4">
        <h2 className="text-heading uppercase text-fg-muted">My Leases</h2>
        <p className="text-body text-fg-faint">No saved leases yet.</p>
      </Section>
    );
  }
  return (
    <Section label="library" className="space-y-3 px-4 py-4">
      <h2 className="text-heading uppercase text-fg-muted">My Leases</h2>
      <ul className="space-y-2">
        {leases.map((l) => {
          const isStandard = standardId === l.id;
          return (
            <li key={l.id} className="rounded-sm border border-rule bg-paper-raised shadow-paper px-3 py-2 flex flex-col gap-1">
              <div className="flex items-center gap-2 flex-wrap">
                <button type="button" onClick={() => onOpen(l.id)} aria-label={`Open ${l.name}`}
                  className="text-body text-ink font-sans hover:underline text-left">
                  {isStandard && <span aria-label="standard lease">★ </span>}
                  {l.name}
                </button>
                <small className="text-small text-fg-muted">
                  {l.findingCount} finding{l.findingCount === 1 ? '' : 's'}
                  {' · '}
                  {new Date(l.createdAt).toLocaleDateString()}
                </small>
              </div>
              <div className="flex gap-2 flex-wrap">
                {!isStandard && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onSetStandard(l.id)}
                    aria-label={`Set ${l.name} as standard`}
                  >
                    Set as standard
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const next = window.prompt('New name:', l.name)?.trim();
                    if (next && next !== l.name) onRename(l.id, next);
                  }}
                  aria-label={`Rename ${l.name}`}
                >
                  Rename
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(l.id)}
                  aria-label={`Delete ${l.name}`}
                >
                  Delete
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
