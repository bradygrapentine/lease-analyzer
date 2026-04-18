import { describe, it, expect } from 'vitest';
import { mapPdfError } from './errors';
import { PasswordProtectedPdfError } from './types';

describe('mapPdfError', () => {
  it('maps a pdf.js PasswordException to PasswordProtectedPdfError', () => {
    const pdfjsErr = Object.assign(new Error('No password given'), {
      name: 'PasswordException',
      code: 1,
    });
    const mapped = mapPdfError(pdfjsErr);
    expect(mapped).toBeInstanceOf(PasswordProtectedPdfError);
    expect(mapped.message).toMatch(/password-protected/i);
  });

  it('passes other errors through unchanged', () => {
    const other = new Error('something else');
    expect(mapPdfError(other)).toBe(other);
  });

  it('wraps non-Error throws in a generic Error', () => {
    const mapped = mapPdfError('weird string');
    expect(mapped).toBeInstanceOf(Error);
    expect(mapped.message).toContain('weird string');
  });
});
