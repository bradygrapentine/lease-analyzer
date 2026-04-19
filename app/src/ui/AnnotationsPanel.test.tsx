import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AnnotationsPanel } from './AnnotationsPanel';
import type { Annotation } from '../annotations/annotations';

function ann(over: Partial<Annotation>): Annotation {
  return {
    id: 'a1',
    leaseId: 'L1',
    paragraphIndex: 3,
    text: 'Ask about renewal',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const noop = (): void => {};

describe('AnnotationsPanel', () => {
  it('prompts the user to pick a finding when paragraphIndex is null', () => {
    render(
      <AnnotationsPanel
        leaseId="L1"
        paragraphIndex={null}
        annotations={[]}
        onSave={noop}
        onUpdate={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText(/click a finding to attach a note/i)).toBeInTheDocument();
  });

  it('shows "no notes yet" when paragraphIndex is set but there are none for it', () => {
    render(
      <AnnotationsPanel
        leaseId="L1"
        paragraphIndex={3}
        annotations={[ann({ paragraphIndex: 99 })]}
        onSave={noop}
        onUpdate={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
  });

  it('renders only annotations for the selected paragraphIndex', () => {
    render(
      <AnnotationsPanel
        leaseId="L1"
        paragraphIndex={3}
        annotations={[
          ann({ id: 'keep', paragraphIndex: 3, text: 'visible note' }),
          ann({ id: 'drop', paragraphIndex: 7, text: 'other-paragraph' }),
        ]}
        onSave={noop}
        onUpdate={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('visible note')).toBeInTheDocument();
    expect(screen.queryByText('other-paragraph')).not.toBeInTheDocument();
  });

  it('calls onSave with the trimmed text when the add form is submitted', async () => {
    const onSave = vi.fn();
    render(
      <AnnotationsPanel
        leaseId="L1"
        paragraphIndex={3}
        annotations={[]}
        onSave={onSave}
        onUpdate={noop}
        onDelete={noop}
      />,
    );
    await userEvent.type(screen.getByLabelText(/new note/i), '  a new note  ');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    expect(onSave).toHaveBeenCalledWith('a new note');
  });

  it('does not call onSave when the note text is blank', async () => {
    const onSave = vi.fn();
    render(
      <AnnotationsPanel
        leaseId="L1"
        paragraphIndex={3}
        annotations={[]}
        onSave={onSave}
        onUpdate={noop}
        onDelete={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not render the add form when paragraphIndex is null', () => {
    render(
      <AnnotationsPanel
        leaseId="L1"
        paragraphIndex={null}
        annotations={[]}
        onSave={noop}
        onUpdate={noop}
        onDelete={noop}
      />,
    );
    expect(screen.queryByLabelText(/new note/i)).not.toBeInTheDocument();
  });

  it('fires onDelete with the annotation id', async () => {
    const onDelete = vi.fn();
    render(
      <AnnotationsPanel
        leaseId="L1"
        paragraphIndex={3}
        annotations={[ann({ id: 'gone', paragraphIndex: 3, text: 'bye' })]}
        onSave={noop}
        onUpdate={noop}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete note/i }));
    expect(onDelete).toHaveBeenCalledWith('gone');
  });

  it('enters edit mode and calls onUpdate with the patched text', async () => {
    const onUpdate = vi.fn();
    render(
      <AnnotationsPanel
        leaseId="L1"
        paragraphIndex={3}
        annotations={[ann({ id: 'e', paragraphIndex: 3, text: 'old' })]}
        onSave={noop}
        onUpdate={onUpdate}
        onDelete={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit note/i }));
    const input = screen.getByLabelText(/edit note text/i) as HTMLTextAreaElement;
    await userEvent.clear(input);
    await userEvent.type(input, 'updated');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onUpdate).toHaveBeenCalledWith('e', 'updated');
  });

  it('cancel exits edit mode without calling onUpdate', async () => {
    const onUpdate = vi.fn();
    render(
      <AnnotationsPanel
        leaseId="L1"
        paragraphIndex={3}
        annotations={[ann({ id: 'e', paragraphIndex: 3, text: 'old' })]}
        onSave={noop}
        onUpdate={onUpdate}
        onDelete={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit note/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /edit note/i })).toBeInTheDocument();
  });

  it('does not call onUpdate when edited text is blanked out', async () => {
    const onUpdate = vi.fn();
    render(
      <AnnotationsPanel
        leaseId="L1"
        paragraphIndex={3}
        annotations={[ann({ id: 'e', paragraphIndex: 3, text: 'old' })]}
        onSave={noop}
        onUpdate={onUpdate}
        onDelete={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit note/i }));
    await userEvent.clear(screen.getByLabelText(/edit note text/i));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
