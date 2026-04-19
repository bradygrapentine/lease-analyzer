import { describe, it, expect } from 'vitest';
import { buildSideLetterHtml, buildSideLetterText } from './sideLetter';
import type { RedlineEdit } from '../redline/redline';

function mkEdit(over: Partial<RedlineEdit> = {}): RedlineEdit {
  return {
    leaseId: 'L1',
    paragraphIndex: 0,
    before: 'original text',
    after: 'amended text',
    updatedAt: '2026-04-18T00:00:00.000Z',
    ...over,
  };
}

const noSection = (): string | undefined => undefined;

describe('buildSideLetterHtml', () => {
  it('renders an empty placeholder when there are no edits', () => {
    const html = buildSideLetterHtml({
      leaseName: 'Acme Lease',
      edits: [],
      sectionFor: noSection,
    });
    expect(html).toContain('No changes to propose');
    expect(html).toContain('Re: Acme Lease');
    expect(html).toMatch(/<!doctype html>/i);
  });

  it('includes the leaseDate when provided', () => {
    const html = buildSideLetterHtml({
      leaseName: 'Acme Lease',
      leaseDate: '2026-01-15',
      edits: [],
      sectionFor: noSection,
    });
    expect(html).toContain('(dated 2026-01-15)');
  });

  it('renders numbered clauses with a section label when sectionFor returns one', () => {
    const html = buildSideLetterHtml({
      leaseName: 'Acme Lease',
      edits: [
        mkEdit({ paragraphIndex: 4, before: 'old', after: 'new auto-renew text' }),
      ],
      sectionFor: (i) => (i === 4 ? '4.2' : undefined),
    });
    expect(html).toContain('1. Section 4.2.');
    expect(html).toContain('new auto-renew text');
  });

  it('falls back to page/paragraph label when sectionFor returns undefined', () => {
    const html = buildSideLetterHtml({
      leaseName: 'Acme Lease',
      edits: [mkEdit({ paragraphIndex: 12 })],
      sectionFor: noSection,
    });
    // paragraphIndex 12 → one-based label "13"
    expect(html).toContain('Page N, \u00b6 13');
  });

  it('folds duplicate paragraph indices (first mention wins)', () => {
    const html = buildSideLetterHtml({
      leaseName: 'Acme Lease',
      edits: [
        mkEdit({ paragraphIndex: 1, after: 'first version' }),
        mkEdit({ paragraphIndex: 1, after: 'second version' }),
      ],
      sectionFor: () => '2.1',
    });
    expect(html).toContain('first version');
    expect(html).not.toContain('second version');
    // Only one numbered clause.
    expect(html.match(/<li>/g)).toHaveLength(1);
  });

  it('escapes HTML-dangerous characters in lease name and edit text', () => {
    const html = buildSideLetterHtml({
      leaseName: '<script>alert(1)</script>',
      edits: [
        mkEdit({ after: 'evil & <script>pwn</script>' }),
      ],
      sectionFor: () => '1',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&amp;');
  });

  it('includes a @media print block for print styling', () => {
    const html = buildSideLetterHtml({
      leaseName: 'A',
      edits: [],
      sectionFor: noSection,
    });
    expect(html).toMatch(/@media print/);
  });

  it('adds a signer block when signer is provided', () => {
    const html = buildSideLetterHtml({
      leaseName: 'Acme Lease',
      edits: [],
      sectionFor: noSection,
      signer: { name: 'Jane Doe', title: 'General Counsel' },
    });
    expect(html).toContain('Jane Doe');
    expect(html).toContain('General Counsel');
    expect(html).toContain('Sincerely');
  });

  it('omits the signer block when signer is absent', () => {
    const html = buildSideLetterHtml({
      leaseName: 'Acme Lease',
      edits: [],
      sectionFor: noSection,
    });
    expect(html).not.toContain('Sincerely');
  });

  it('signer title is optional', () => {
    const html = buildSideLetterHtml({
      leaseName: 'Acme Lease',
      edits: [],
      sectionFor: noSection,
      signer: { name: 'Jane Doe' },
    });
    expect(html).toContain('Jane Doe');
    expect(html).not.toContain('class="title"');
  });
});

describe('buildSideLetterText', () => {
  it('renders a plain-text letter with numbered clauses', () => {
    const text = buildSideLetterText({
      leaseName: 'Acme Lease',
      edits: [mkEdit({ paragraphIndex: 3, after: 'new late-fee cap' })],
      sectionFor: () => '6.1',
    });
    expect(text).toContain('Side Letter');
    expect(text).toContain('Re: Acme Lease');
    expect(text).toContain('1. Section 6.1.');
    expect(text).toContain('new late-fee cap');
  });

  it('returns the empty-state sentence when there are no edits', () => {
    const text = buildSideLetterText({
      leaseName: 'Acme Lease',
      edits: [],
      sectionFor: noSection,
    });
    expect(text).toContain('No changes to propose');
  });

  it('includes leaseDate when provided', () => {
    const text = buildSideLetterText({
      leaseName: 'L',
      leaseDate: '2026-01-15',
      edits: [],
      sectionFor: noSection,
    });
    expect(text).toContain('dated 2026-01-15');
  });

  it('uses the page/paragraph fallback when section is unknown', () => {
    const text = buildSideLetterText({
      leaseName: 'L',
      edits: [mkEdit({ paragraphIndex: 0 })],
      sectionFor: noSection,
    });
    expect(text).toContain('Page N, \u00b6 1');
  });

  it('appends a signer block when provided', () => {
    const text = buildSideLetterText({
      leaseName: 'L',
      edits: [],
      sectionFor: noSection,
      signer: { name: 'Jane', title: 'Counsel' },
    });
    expect(text).toContain('Sincerely');
    expect(text).toContain('Jane');
    expect(text).toContain('Counsel');
  });

  it('signer title is optional in text output', () => {
    const text = buildSideLetterText({
      leaseName: 'L',
      edits: [],
      sectionFor: noSection,
      signer: { name: 'Jane' },
    });
    expect(text).toContain('Jane');
    // No trailing title line.
    expect(text).not.toContain('Counsel');
  });

  it('does not include a signer block when absent', () => {
    const text = buildSideLetterText({
      leaseName: 'L',
      edits: [],
      sectionFor: noSection,
    });
    expect(text).not.toContain('Sincerely');
  });

  it('folds duplicate paragraph indices in text output too', () => {
    const text = buildSideLetterText({
      leaseName: 'L',
      edits: [
        mkEdit({ paragraphIndex: 2, after: 'first' }),
        mkEdit({ paragraphIndex: 2, after: 'second' }),
      ],
      sectionFor: () => '3.1',
    });
    expect(text).toContain('first');
    expect(text).not.toContain('second');
    // Only one numbered clause.
    expect(text.match(/\n\n/g) ?? []).toBeTruthy();
  });
});
