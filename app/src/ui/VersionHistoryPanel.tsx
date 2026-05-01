import { useState } from 'react';
import type { LeaseVersion } from '../negotiation/versionHistory';
import { ConfirmDialog } from './primitives/ConfirmDialog';

export interface VersionHistoryPanelProps {
  versions: LeaseVersion[];
  currentEditCount: number;
  onCreateVersion: (label?: string, note?: string) => void;
  onRestoreVersion: (versionId: string) => void;
  onDeleteVersion: (versionId: string) => void;
  onExportVersion: (versionId: string) => void;
}

/**
 * Timeline-style list of saved lease versions. Pure presentation — all
 * persistence + redline-store side-effects happen in the caller. The
 * header exposes a "Create new version" form (label + note) that fires
 * `onCreateVersion` with trimmed values. The restore/export/delete
 * buttons on each entry bubble the matching versionId up to the caller.
 */
export function VersionHistoryPanel({
  versions,
  currentEditCount,
  onCreateVersion,
  onRestoreVersion,
  onDeleteVersion,
  onExportVersion,
}: VersionHistoryPanelProps): JSX.Element {
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  // Wave 59 Slice 1 — destructive guard. Track which version (if any) is
  // pending deletion so the ConfirmDialog can surface its label + edit count.
  const [pendingDelete, setPendingDelete] = useState<LeaseVersion | null>(null);

  function handleCreate(e: React.FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const l = label.trim();
    const n = note.trim();
    onCreateVersion(l === '' ? undefined : l, n === '' ? undefined : n);
    setLabel('');
    setNote('');
  }

  return (
    <section aria-label="version history">
      <h2>Version history</h2>

      <form
        onSubmit={handleCreate}
        aria-label="create new version"
        className="version-create"
      >
        <h3>Create new version</h3>
        <p>
          {currentEditCount} unsaved edit{currentEditCount === 1 ? '' : 's'}
        </p>
        <label>
          Label
          <input
            type="text"
            aria-label="new version label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </label>
        <label>
          Note
          <textarea
            aria-label="new version note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <button type="submit">Save version</button>
      </form>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete version ${pendingDelete?.label ?? pendingDelete?.versionId ?? ''}?`}
        body={
          pendingDelete
            ? `This will remove ${pendingDelete.edits.length} edit${pendingDelete.edits.length === 1 ? '' : 's'} captured in this version. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        confirmTone="destructive"
        onConfirm={() => {
          if (pendingDelete) onDeleteVersion(pendingDelete.versionId);
          setPendingDelete(null);
        }}
        onCancel={() => setPendingDelete(null)}
      />

      {versions.length === 0 ? (
        <p>No versions saved yet.</p>
      ) : (
        <ol className="version-timeline">
          {versions.map((v) => (
            <li key={v.versionId} data-version-id={v.versionId}>
              <div className="version-meta">
                <time dateTime={v.createdAt}>{v.createdAt}</time>
                {v.label ? (
                  <strong aria-label={`version label`}> {v.label}</strong>
                ) : null}
                <span>
                  {' '}
                  ({v.edits.length} edit{v.edits.length === 1 ? '' : 's'})
                </span>
              </div>
              {v.note ? <p className="version-note">{v.note}</p> : null}
              <div className="version-actions">
                <button
                  type="button"
                  aria-label={`restore version ${v.label ?? v.versionId}`}
                  onClick={() => onRestoreVersion(v.versionId)}
                >
                  Restore
                </button>
                <button
                  type="button"
                  aria-label={`export version ${v.label ?? v.versionId}`}
                  onClick={() => onExportVersion(v.versionId)}
                >
                  Export
                </button>
                <button
                  type="button"
                  aria-label={`delete version ${v.label ?? v.versionId}`}
                  onClick={() => setPendingDelete(v)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
