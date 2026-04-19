import type { LeaseMetadata } from '../storage/storage';

interface LibraryPanelProps {
  leases: LeaseMetadata[];
  standardId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onSetStandard: (id: string) => void;
}

export function LibraryPanel({
  leases,
  standardId,
  onOpen,
  onDelete,
  onSetStandard,
}: LibraryPanelProps): JSX.Element {
  if (leases.length === 0) {
    return (
      <section aria-label="library">
        <h2>My Leases</h2>
        <p>No saved leases yet.</p>
      </section>
    );
  }
  return (
    <section aria-label="library">
      <h2>My Leases</h2>
      <ul>
        {leases.map((l) => {
          const isStandard = standardId === l.id;
          return (
            <li key={l.id}>
              <button type="button" onClick={() => onOpen(l.id)} aria-label={`Open ${l.name}`}>
                {isStandard && <span aria-label="standard lease">★ </span>}
                {l.name}
              </button>
              <small>
                {' · '}
                {l.findingCount} finding{l.findingCount === 1 ? '' : 's'}
                {' · '}
                {new Date(l.createdAt).toLocaleDateString()}
              </small>
              {!isStandard && (
                <button
                  type="button"
                  onClick={() => onSetStandard(l.id)}
                  aria-label={`Set ${l.name} as standard`}
                >
                  Set as standard
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(l.id)}
                aria-label={`Delete ${l.name}`}
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
