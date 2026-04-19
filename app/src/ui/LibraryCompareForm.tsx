import { useState } from 'react';
import type { LeaseMetadata } from '../storage/storage';

interface LibraryCompareFormProps {
  leases: LeaseMetadata[];
  onCompare: (aId: string, bId: string) => void;
}

export function LibraryCompareForm({
  leases,
  onCompare,
}: LibraryCompareFormProps): JSX.Element | null {
  const [aId, setAId] = useState<string>('');
  const [bId, setBId] = useState<string>('');

  if (leases.length < 2) return null;

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    if (!aId || !bId || aId === bId) return;
    onCompare(aId, bId);
  }

  return (
    <form aria-label="compare leases" onSubmit={submit}>
      <label>
        Old:
        <select aria-label="lease A" value={aId} onChange={(e) => setAId(e.target.value)}>
          <option value="">—</option>
          {leases.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        New:
        <select aria-label="lease B" value={bId} onChange={(e) => setBId(e.target.value)}>
          <option value="">—</option>
          {leases.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={!aId || !bId || aId === bId}>
        Compare
      </button>
    </form>
  );
}
