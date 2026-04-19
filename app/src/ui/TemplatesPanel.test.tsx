import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplatesPanel } from './TemplatesPanel';
import type { ClauseTemplate } from '../templates/types';

function tpl(over: Partial<ClauseTemplate>): ClauseTemplate {
  return {
    id: 't1',
    name: 'My arbitration',
    text: 'Any dispute shall be arbitrated.',
    createdAt: 0,
    updatedAt: 0,
    ...over,
  };
}

const noop = (): void => {};

describe('TemplatesPanel', () => {
  it('shows an empty-state message when there are no templates', () => {
    render(
      <TemplatesPanel templates={[]} onSave={noop} onUpdate={noop} onDelete={noop} />,
    );
    expect(screen.getByText(/no clause templates/i)).toBeInTheDocument();
  });

  it('renders each template with name + text', () => {
    render(
      <TemplatesPanel
        templates={[tpl({ id: 'a', name: 'A' }), tpl({ id: 'b', name: 'B', text: 'second body' })]}
        onSave={noop}
        onUpdate={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('second body')).toBeInTheDocument();
  });

  it('calls onSave with the trimmed name + text from the add form', async () => {
    const onSave = vi.fn();
    render(
      <TemplatesPanel templates={[]} onSave={onSave} onUpdate={noop} onDelete={noop} />,
    );
    await userEvent.type(screen.getByLabelText(/new template name/i), '  My clause  ');
    await userEvent.type(screen.getByLabelText(/new template text/i), '  Clause body  ');
    await userEvent.click(screen.getByRole('button', { name: /add template/i }));
    expect(onSave).toHaveBeenCalledWith({ name: 'My clause', text: 'Clause body' });
  });

  it('does not call onSave when name or text are blank', async () => {
    const onSave = vi.fn();
    render(
      <TemplatesPanel templates={[]} onSave={onSave} onUpdate={noop} onDelete={noop} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /add template/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('fires onDelete with the template id', async () => {
    const onDelete = vi.fn();
    render(
      <TemplatesPanel
        templates={[tpl({ id: 'gone', name: 'Gone' })]}
        onSave={noop}
        onUpdate={noop}
        onDelete={onDelete}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /delete gone/i }));
    expect(onDelete).toHaveBeenCalledWith('gone');
  });

  it('enters edit mode and calls onUpdate with the patched values', async () => {
    const onUpdate = vi.fn();
    render(
      <TemplatesPanel
        templates={[tpl({ id: 'e', name: 'Old' })]}
        onSave={noop}
        onUpdate={onUpdate}
        onDelete={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit old/i }));
    const nameInput = screen.getByLabelText(/^template name$/i) as HTMLInputElement;
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Renamed');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onUpdate).toHaveBeenCalledWith(
      'e',
      expect.objectContaining({ name: 'Renamed' }),
    );
  });

  it('exits edit mode without calling onUpdate when user cancels', async () => {
    const onUpdate = vi.fn();
    render(
      <TemplatesPanel
        templates={[tpl({ id: 'e', name: 'Old' })]}
        onSave={noop}
        onUpdate={onUpdate}
        onDelete={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit old/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onUpdate).not.toHaveBeenCalled();
    // Back to display mode:
    expect(screen.getByRole('button', { name: /edit old/i })).toBeInTheDocument();
  });

  it('does not call onUpdate when edited name/text are blanked out', async () => {
    const onUpdate = vi.fn();
    render(
      <TemplatesPanel
        templates={[tpl({ id: 'e', name: 'Old' })]}
        onSave={noop}
        onUpdate={onUpdate}
        onDelete={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit old/i }));
    await userEvent.clear(screen.getByLabelText(/^template name$/i));
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
