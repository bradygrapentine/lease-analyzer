import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import type { LeaseVersion } from '../negotiation/versionHistory';
import type { RedlineEdit } from '../redline/redline';

function mkEdit(over: Partial<RedlineEdit> = {}): RedlineEdit {
  return {
    leaseId: 'L1',
    paragraphIndex: 0,
    before: 'b',
    after: 'a',
    updatedAt: '2026-04-18T00:00:00.000Z',
    ...over,
  };
}

function mkVersion(over: Partial<LeaseVersion> = {}): LeaseVersion {
  return {
    versionId: 'v1',
    leaseId: 'L1',
    createdAt: '2026-04-18T12:00:00.000Z',
    edits: [mkEdit()],
    ...over,
  };
}

const noop = (): void => {};

describe('VersionHistoryPanel', () => {
  it('shows the empty-state message when there are no versions', () => {
    render(
      <VersionHistoryPanel
        versions={[]}
        currentEditCount={0}
        onCreateVersion={noop}
        onRestoreVersion={noop}
        onDeleteVersion={noop}
        onExportVersion={noop}
      />,
    );
    expect(screen.getByText(/no versions saved/i)).toBeInTheDocument();
  });

  it('renders the current unsaved edit count (pluralized)', () => {
    render(
      <VersionHistoryPanel
        versions={[]}
        currentEditCount={3}
        onCreateVersion={noop}
        onRestoreVersion={noop}
        onDeleteVersion={noop}
        onExportVersion={noop}
      />,
    );
    expect(screen.getByText(/3 unsaved edits/i)).toBeInTheDocument();
  });

  it('renders "1 unsaved edit" in the singular', () => {
    render(
      <VersionHistoryPanel
        versions={[]}
        currentEditCount={1}
        onCreateVersion={noop}
        onRestoreVersion={noop}
        onDeleteVersion={noop}
        onExportVersion={noop}
      />,
    );
    expect(screen.getByText(/1 unsaved edit\b/i)).toBeInTheDocument();
  });

  it('renders an entry per version with label + note + edit count', () => {
    render(
      <VersionHistoryPanel
        versions={[
          mkVersion({ versionId: 'v1', label: 'Draft 1', note: 'first pass', edits: [mkEdit(), mkEdit({ paragraphIndex: 1 })] }),
          mkVersion({ versionId: 'v2', label: 'Draft 2', createdAt: '2026-04-19T12:00:00.000Z' }),
        ]}
        currentEditCount={0}
        onCreateVersion={noop}
        onRestoreVersion={noop}
        onDeleteVersion={noop}
        onExportVersion={noop}
      />,
    );
    expect(screen.getByText('Draft 1')).toBeInTheDocument();
    expect(screen.getByText('Draft 2')).toBeInTheDocument();
    expect(screen.getByText('first pass')).toBeInTheDocument();
    // First has 2 edits, second has 1.
    expect(screen.getByText(/\(2 edits\)/i)).toBeInTheDocument();
    expect(screen.getByText(/\(1 edit\)/i)).toBeInTheDocument();
  });

  it('Save version fires onCreateVersion with the trimmed inputs', async () => {
    const onCreateVersion = vi.fn();
    render(
      <VersionHistoryPanel
        versions={[]}
        currentEditCount={0}
        onCreateVersion={onCreateVersion}
        onRestoreVersion={noop}
        onDeleteVersion={noop}
        onExportVersion={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/new version label/i), '  Draft one  ');
    await userEvent.type(screen.getByLabelText(/new version note/i), ' before rent ');
    await userEvent.click(screen.getByRole('button', { name: /save version/i }));
    expect(onCreateVersion).toHaveBeenCalledWith('Draft one', 'before rent');
  });

  it('Save version with blank label + note passes undefined for both', async () => {
    const onCreateVersion = vi.fn();
    render(
      <VersionHistoryPanel
        versions={[]}
        currentEditCount={0}
        onCreateVersion={onCreateVersion}
        onRestoreVersion={noop}
        onDeleteVersion={noop}
        onExportVersion={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /save version/i }));
    expect(onCreateVersion).toHaveBeenCalledWith(undefined, undefined);
  });

  it('Restore fires onRestoreVersion with the versionId', async () => {
    const onRestoreVersion = vi.fn();
    render(
      <VersionHistoryPanel
        versions={[mkVersion({ versionId: 'v1', label: 'one' })]}
        currentEditCount={0}
        onCreateVersion={noop}
        onRestoreVersion={onRestoreVersion}
        onDeleteVersion={noop}
        onExportVersion={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /restore version one/i }));
    expect(onRestoreVersion).toHaveBeenCalledWith('v1');
  });

  it('Export fires onExportVersion with the versionId', async () => {
    const onExportVersion = vi.fn();
    render(
      <VersionHistoryPanel
        versions={[mkVersion({ versionId: 'v1', label: 'one' })]}
        currentEditCount={0}
        onCreateVersion={noop}
        onRestoreVersion={noop}
        onDeleteVersion={noop}
        onExportVersion={onExportVersion}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /export version one/i }));
    expect(onExportVersion).toHaveBeenCalledWith('v1');
  });

  it('Delete opens a confirm dialog and only fires onDeleteVersion after Confirm', async () => {
    const onDeleteVersion = vi.fn();
    render(
      <VersionHistoryPanel
        versions={[mkVersion({ versionId: 'v1', label: 'one', edits: [mkEdit(), mkEdit({ paragraphIndex: 1 })] })]}
        currentEditCount={0}
        onCreateVersion={noop}
        onRestoreVersion={noop}
        onDeleteVersion={onDeleteVersion}
        onExportVersion={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete version one/i }));
    // Wave 59 Slice 1 — destructive guard. The button should not call
    // onDeleteVersion synchronously; instead a confirm dialog appears.
    expect(onDeleteVersion).not.toHaveBeenCalled();
    // Dialog body names the version label + its edit count.
    expect(await screen.findByRole('dialog')).toHaveTextContent(/one/i);
    expect(screen.getByRole('dialog')).toHaveTextContent(/2 edits/i);
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(onDeleteVersion).toHaveBeenCalledWith('v1');
  });

  it('Delete confirm dialog Cancel does NOT call onDeleteVersion', async () => {
    const onDeleteVersion = vi.fn();
    render(
      <VersionHistoryPanel
        versions={[mkVersion({ versionId: 'v1', label: 'one' })]}
        currentEditCount={0}
        onCreateVersion={noop}
        onRestoreVersion={noop}
        onDeleteVersion={onDeleteVersion}
        onExportVersion={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete version one/i }));
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onDeleteVersion).not.toHaveBeenCalled();
  });

  it('uses versionId as the accessible label when there is no user label', () => {
    render(
      <VersionHistoryPanel
        versions={[mkVersion({ versionId: 'abc-123' })]}
        currentEditCount={0}
        onCreateVersion={noop}
        onRestoreVersion={noop}
        onDeleteVersion={noop}
        onExportVersion={noop}
      />,
    );
    expect(screen.getByRole('button', { name: /restore version abc-123/i })).toBeInTheDocument();
  });

  it('clears the label + note fields after a successful save', async () => {
    render(
      <VersionHistoryPanel
        versions={[]}
        currentEditCount={0}
        onCreateVersion={noop}
        onRestoreVersion={noop}
        onDeleteVersion={noop}
        onExportVersion={noop}
      />,
    );
    const labelInput = screen.getByLabelText(/new version label/i) as HTMLInputElement;
    const noteInput = screen.getByLabelText(/new version note/i) as HTMLTextAreaElement;
    await userEvent.type(labelInput, 'a');
    await userEvent.type(noteInput, 'b');
    await userEvent.click(screen.getByRole('button', { name: /save version/i }));
    expect(labelInput.value).toBe('');
    expect(noteInput.value).toBe('');
  });
});
