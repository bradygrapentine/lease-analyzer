import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppRedlinePane } from './AppRedlinePane';
import type { LeaseDocument } from '../parser/types';
import type { UseRedlineStateApi } from '../App/useRedlineState';
import type { UseVersionHistoryApi } from '../App/useVersionHistory';
import type { UseSideLetterApi } from '../App/useSideLetter';

function makeDoc(): LeaseDocument {
  return {
    pages: [{ pageNumber: 1, width: 612, height: 792, items: [] }],
    paragraphs: [{ text: 'Tenant shall pay rent.', page: 1 }],
    sections: [],
    raw: 'Tenant shall pay rent.',
  };
}

function makeRedline(): UseRedlineStateApi {
  return {
    redlineEdits: [],
    editParagraph: vi.fn(),
    deleteParagraphEdit: vi.fn(),
    buildHtml: vi.fn(() => '<html></html>'),
    replaceAll: vi.fn(),
    applySuggestion: vi.fn(),
  } as unknown as UseRedlineStateApi;
}

function makeVersionHistory(): UseVersionHistoryApi {
  return {
    versions: [],
    createVersion: vi.fn(),
    restoreVersion: vi.fn(),
    removeVersion: vi.fn(),
    refresh: vi.fn(),
    exportVersion: vi.fn(),
    getVersionById: vi.fn(),
  } as unknown as UseVersionHistoryApi;
}

function makeSideLetter(): UseSideLetterApi {
  return {
    signerDraft: { name: '', title: '' },
    previewHtml: null,
    setSignerDraft: vi.fn(),
    preview: vi.fn(),
    clearPreview: vi.fn(),
    download: vi.fn(),
    downloadPdf: vi.fn(() => Promise.resolve()),
  } as unknown as UseSideLetterApi;
}

describe('AppRedlinePane', () => {
  it('mounts the redline + version-history + side-letter panels', () => {
    render(
      <AppRedlinePane
        doc={makeDoc()}
        leaseName="lease.pdf"
        redline={makeRedline()}
        versionHistory={makeVersionHistory()}
        sideLetter={makeSideLetter()}
        sectionForParagraph={() => undefined}
        safeAudit={vi.fn(() => Promise.resolve())}
      />,
    );
    expect(screen.getByRole('region', { name: /redline/i })).toBeInTheDocument();
    expect(screen.getAllByText(/version history/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('region', { name: /side letter/i })).toBeInTheDocument();
  });

  it('audits a side-letter HTML download with kind=export, format=html', async () => {
    const safeAudit = vi.fn(() => Promise.resolve());
    const sideLetter = makeSideLetter();
    render(
      <AppRedlinePane
        doc={makeDoc()}
        leaseName="lease.pdf"
        redline={makeRedline()}
        versionHistory={makeVersionHistory()}
        sideLetter={sideLetter}
        sectionForParagraph={() => undefined}
        safeAudit={safeAudit}
      />,
    );
    const downloadBtn = screen.getByRole('button', { name: /^download side letter html$/i });
    await userEvent.click(downloadBtn);
    expect(sideLetter.download).toHaveBeenCalledTimes(1);
    expect(safeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'export',
        payload: expect.objectContaining({ artifact: 'side-letter', format: 'html' }),
      }),
    );
  });
});
