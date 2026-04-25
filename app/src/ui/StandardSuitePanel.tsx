import type { StandardClause } from '../clauseStandard/standardSuite';

export interface StandardSuitePanelProps {
  standards: StandardClause[];
  onDelete: (id: string) => void;
}

export function StandardSuitePanel({
  standards,
  onDelete,
}: StandardSuitePanelProps): JSX.Element {
  if (standards.length === 0) {
    return (
      <aside aria-label="standard clause suite">
        <p>No standards yet. Promote a clause from a lease to start your suite.</p>
      </aside>
    );
  }

  return (
    <aside aria-label="standard clause suite">
      <h2>My standard clauses</h2>
      <ul>
        {standards.map((s) => (
          <li key={s.id}>
            <strong>{s.name}</strong>
            <small>
              {' '}
              from {s.sourceLeaseId} ¶{s.sourceParagraphIndex}
            </small>
            <button
              type="button"
              aria-label={`delete ${s.name}`}
              onClick={() => onDelete(s.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
