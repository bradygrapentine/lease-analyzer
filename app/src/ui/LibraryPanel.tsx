import type { LeaseMetadata } from '../storage/storage';

interface LibraryPanelProps {
  leases: LeaseMetadata[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}

export function LibraryPanel({ leases, onOpen, onDelete }: LibraryPanelProps): JSX.Element {
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
        {leases.map((l) => (
          <li key={l.id}>
            <button type="button" onClick={() => onOpen(l.id)} aria-label={`Open ${l.name}`}>
              {l.name}
            </button>
            <small>
              {' · '}
              {l.findingCount} finding{l.findingCount === 1 ? '' : 's'}
              {' · '}
              {new Date(l.createdAt).toLocaleDateString()}
            </small>
            <button
              type="button"
              onClick={() => onDelete(l.id)}
              aria-label={`Delete ${l.name}`}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
