import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildSummary, copyToClipboard } from './copySummary';
import type { Finding } from '../rules/types';

function f(over: Partial<Finding> = {}): Finding {
  return {
    ruleId: 'r-auto-renew',
    severity: 'high',
    category: 'termination',
    title: 'Auto-renewal',
    explanation: 'Lease auto-renews unless 60-day notice.',
    citation: null,
    page: 1,
    paragraphIndex: 3,
    snippet: 'shall automatically renew',
    span: { start: 0, end: 10 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: 'v1',
    ...over,
  };
}

describe('buildSummary', () => {
  it('produces both html and plain strings', () => {
    const out = buildSummary({ leaseName: 'Unit 4B', findings: [f()] });
    expect(typeof out.html).toBe('string');
    expect(typeof out.plain).toBe('string');
    expect(out.html).toContain('<h1>');
    expect(out.html).toContain('Unit 4B');
    expect(out.plain).toContain('Unit 4B');
  });

  it('groups findings by severity and skips empty groups', () => {
    const findings = [f({ severity: 'high', title: 'H1' }), f({ severity: 'low', title: 'L1' })];
    const { html, plain } = buildSummary({ leaseName: 'X', findings });
    expect(html).toContain('High');
    expect(html).toContain('Low');
    expect(html).not.toContain('Medium');
    expect(plain).toContain('High');
    expect(plain).toContain('Low');
    expect(plain).not.toContain('Medium');
    expect(plain).toContain('H1');
    expect(plain).toContain('L1');
  });

  it('escapes HTML-special characters in finding text', () => {
    const { html } = buildSummary({
      leaseName: '<lease>',
      findings: [f({ title: 'a&b', explanation: '"quoted"' })],
    });
    expect(html).toContain('&lt;lease&gt;');
    expect(html).toContain('a&amp;b');
    expect(html).toContain('&quot;quoted&quot;');
    expect(html).not.toContain('<lease>');
  });

  it('renders an empty-state when there are no findings', () => {
    const out = buildSummary({ leaseName: 'Empty', findings: [] });
    expect(out.plain).toMatch(/no findings/i);
    expect(out.html).toMatch(/no findings/i);
  });

  it('includes page numbers in the plain-text output', () => {
    const out = buildSummary({
      leaseName: 'L',
      findings: [f({ page: 7, title: 'T' })],
    });
    expect(out.plain).toContain('p.7');
  });
});

describe('copyToClipboard', () => {
  const origClipboard = (globalThis.navigator as { clipboard?: unknown }).clipboard;
  const origClipboardItem = (globalThis as { ClipboardItem?: unknown }).ClipboardItem;

  beforeEach(() => {
    class FakeClipboardItem {
      constructor(public data: Record<string, Blob>) {}
    }
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem =
      FakeClipboardItem as unknown as typeof ClipboardItem;
  });
  afterEach(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: origClipboard,
      configurable: true,
      writable: true,
    });
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = origClipboardItem;
  });

  it('writes both text/html and text/plain Blobs via navigator.clipboard.write', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { write },
      configurable: true,
      writable: true,
    });

    await copyToClipboard({ html: '<p>hi</p>', plain: 'hi' });
    expect(write).toHaveBeenCalledTimes(1);
    const [items] = write.mock.calls[0]!;
    expect(Array.isArray(items)).toBe(true);
    const item = items[0] as { data: Record<string, Blob> };
    expect(Object.keys(item.data).sort()).toEqual(['text/html', 'text/plain']);
    expect(item.data['text/html']).toBeInstanceOf(Blob);
    expect(item.data['text/plain']).toBeInstanceOf(Blob);
    expect(item.data['text/html']!.type).toBe('text/html');
    expect(item.data['text/plain']!.type).toBe('text/plain');
  });

  it('falls back to writeText when ClipboardItem is unavailable', async () => {
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = undefined;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    await copyToClipboard({ html: '<p>hi</p>', plain: 'plain text' });
    expect(writeText).toHaveBeenCalledWith('plain text');
  });

  // Wave 44: cover the "clipboard object exists but exposes neither
  // write nor writeText" branch — pathological host (browser polyfill,
  // permissions-stripped iframe) where the Clipboard prototype is
  // present but its methods aren't functions.
  it('throws when clipboard exposes no write or writeText method', async () => {
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = undefined;
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: {},
      configurable: true,
      writable: true,
    });
    await expect(copyToClipboard({ html: '', plain: '' })).rejects.toThrow(/present but unusable/);
  });

  it('throws a clear error when the Clipboard API is missing entirely', async () => {
    (globalThis as { ClipboardItem?: unknown }).ClipboardItem = undefined;
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    await expect(copyToClipboard({ html: '', plain: '' })).rejects.toThrow(/Clipboard API/);
  });
});
