import { describe, it, expect } from 'vitest';
import { analyzeFile } from './analyzeFile';
import { makePdf } from '../parser/testFixtures';
import { PasswordProtectedPdfError } from '../parser/types';

describe('analyzeFile', () => {
  it('returns a document and findings from a PDF', async () => {
    const bytes = await makePdf([
      {
        blocks: [
          { text: 'This lease shall auto-renew annually.', x: 72, y: 72 },
          { text: 'Tenant waives any right to a jury trial.', x: 72, y: 110 },
        ],
      },
    ]);
    const result = await analyzeFile(bytes);
    expect(result.doc.paragraphs.length).toBeGreaterThan(0);
    const ids = result.findings.map((f) => f.ruleId);
    expect(ids).toContain('auto-renewal');
    expect(ids).toContain('jury-waiver');
  });

  it('propagates PasswordProtectedPdfError from the parser', async () => {
    const bogus = new Uint8Array([1, 2, 3]);
    await expect(analyzeFile(bogus)).rejects.toThrow();
  });

  it('PasswordProtectedPdfError keeps its type after the pipeline', async () => {
    const err = new PasswordProtectedPdfError();
    expect(err).toBeInstanceOf(PasswordProtectedPdfError);
    expect(err.message).toMatch(/password/i);
  });
});
