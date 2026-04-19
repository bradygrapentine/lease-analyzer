import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RedlinePanel } from './RedlinePanel';
import type { LeaseDocument, Paragraph } from '../parser/types';
import type { RedlineEdit } from '../redline/redline';

function para(text: string): Paragraph {
  return { text, page: 1 };
}

function docOf(...texts: string[]): LeaseDocument {
  return {
    pages: [],
    paragraphs: texts.map(para),
    sections: [],
    raw: texts.join('\n'),
  };
}

function mkEdit(over: Partial<RedlineEdit> = {}): RedlineEdit {
  return {
    leaseId: 'L1',
    paragraphIndex: 0,
    before: 'orig',
    after: 'edited text',
    updatedAt: '2026-04-18T00:00:00.000Z',
    ...over,
  };
}

const noop = (): void => {};

describe('RedlinePanel', () => {
  it('shows an empty-state message when doc is null', () => {
    render(
      <RedlinePanel
        doc={null}
        edits={[]}
        onEditParagraph={noop}
        onDeleteEdit={noop}
        onExportHtml={noop}
      />,
    );
    expect(screen.getByText(/upload a lease/i)).toBeInTheDocument();
  });

  it('renders one list item per paragraph with the original text', () => {
    render(
      <RedlinePanel
        doc={docOf('alpha', 'beta')}
        edits={[]}
        onEditParagraph={noop}
        onDeleteEdit={noop}
        onExportHtml={noop}
      />,
    );
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });

  it('renders the edited text and an "(edited)" badge when an edit exists', () => {
    render(
      <RedlinePanel
        doc={docOf('alpha', 'beta')}
        edits={[mkEdit({ paragraphIndex: 1, before: 'beta', after: 'BETA!' })]}
        onEditParagraph={noop}
        onDeleteEdit={noop}
        onExportHtml={noop}
      />,
    );
    expect(screen.getByText('BETA!')).toBeInTheDocument();
    expect(screen.queryByText('beta')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/paragraph 2 edited badge/i)).toBeInTheDocument();
  });

  it('clicking Edit reveals a textarea prefilled with the current text', async () => {
    render(
      <RedlinePanel
        doc={docOf('first paragraph')}
        edits={[]}
        onEditParagraph={noop}
        onDeleteEdit={noop}
        onExportHtml={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit paragraph 1/i }));
    const ta = screen.getByLabelText(/paragraph 1 text/i) as HTMLTextAreaElement;
    expect(ta.value).toBe('first paragraph');
  });

  it('Save fires onEditParagraph with the trimmed new text', async () => {
    const onEditParagraph = vi.fn();
    render(
      <RedlinePanel
        doc={docOf('alpha')}
        edits={[]}
        onEditParagraph={onEditParagraph}
        onDeleteEdit={noop}
        onExportHtml={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit paragraph 1/i }));
    const ta = screen.getByLabelText(/paragraph 1 text/i);
    await userEvent.clear(ta);
    await userEvent.type(ta, '  new text  ');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onEditParagraph).toHaveBeenCalledWith(0, 'new text');
  });

  it('Save does not fire when the draft is blank', async () => {
    const onEditParagraph = vi.fn();
    render(
      <RedlinePanel
        doc={docOf('alpha')}
        edits={[]}
        onEditParagraph={onEditParagraph}
        onDeleteEdit={noop}
        onExportHtml={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit paragraph 1/i }));
    const ta = screen.getByLabelText(/paragraph 1 text/i);
    await userEvent.clear(ta);
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(onEditParagraph).not.toHaveBeenCalled();
  });

  it('Cancel exits edit mode without firing onEditParagraph', async () => {
    const onEditParagraph = vi.fn();
    render(
      <RedlinePanel
        doc={docOf('alpha')}
        edits={[]}
        onEditParagraph={onEditParagraph}
        onDeleteEdit={noop}
        onExportHtml={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit paragraph 1/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onEditParagraph).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/paragraph 1 text/i)).not.toBeInTheDocument();
  });

  it('Revert fires onDeleteEdit with the paragraphIndex', async () => {
    const onDeleteEdit = vi.fn();
    render(
      <RedlinePanel
        doc={docOf('alpha', 'beta')}
        edits={[mkEdit({ paragraphIndex: 1, before: 'beta', after: 'BETA!' })]}
        onEditParagraph={noop}
        onDeleteEdit={onDeleteEdit}
        onExportHtml={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /revert paragraph 2/i }));
    expect(onDeleteEdit).toHaveBeenCalledWith(1);
  });

  it('Revert button is not shown on unedited paragraphs', () => {
    render(
      <RedlinePanel
        doc={docOf('alpha')}
        edits={[]}
        onEditParagraph={noop}
        onDeleteEdit={noop}
        onExportHtml={noop}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /revert paragraph/i }),
    ).not.toBeInTheDocument();
  });

  it('Export button fires onExportHtml', async () => {
    const onExportHtml = vi.fn();
    render(
      <RedlinePanel
        doc={docOf('alpha')}
        edits={[]}
        onEditParagraph={noop}
        onDeleteEdit={noop}
        onExportHtml={onExportHtml}
      />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: /export redlined html/i }),
    );
    expect(onExportHtml).toHaveBeenCalledTimes(1);
  });

  it('editing a paragraph that already has an edit prefills the textarea with the edited text', async () => {
    render(
      <RedlinePanel
        doc={docOf('alpha')}
        edits={[mkEdit({ paragraphIndex: 0, before: 'alpha', after: 'ALPHA!' })]}
        onEditParagraph={noop}
        onDeleteEdit={noop}
        onExportHtml={noop}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /edit paragraph 1/i }));
    const ta = screen.getByLabelText(/paragraph 1 text/i) as HTMLTextAreaElement;
    expect(ta.value).toBe('ALPHA!');
  });
});
