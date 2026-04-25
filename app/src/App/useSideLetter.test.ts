import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSideLetter } from './useSideLetter';
import type { RedlineEdit } from '../redline/redline';

const sampleEdits: RedlineEdit[] = [
  {
    leaseId: 'L',
    paragraphIndex: 0,
    before: 'old text',
    after: 'new text',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
];

describe('useSideLetter', () => {
  it('omits the signer block when name is blank', () => {
    const { result } = renderHook(() => useSideLetter());
    const html = result.current.buildHtml({
      leaseName: 'Lease.pdf',
      edits: sampleEdits,
    });
    expect(html).not.toMatch(/Signed[, ]/i);
    expect(html.toLowerCase()).toContain('lease.pdf');
  });

  it('includes the signer block when the name is set', () => {
    const { result } = renderHook(() => useSideLetter());
    act(() => {
      result.current.setSignerDraft({ name: '  Jane Doe ', title: ' Counsel ' });
    });
    const html = result.current.buildHtml({
      leaseName: 'Lease.pdf',
      edits: sampleEdits,
    });
    expect(html).toContain('Jane Doe');
    expect(html).toContain('Counsel');
  });
});
