import { describe, it, expect } from 'vitest';
import notice from '../../public/NOTICE?raw';

describe('app/public/NOTICE', () => {
  it('is non-empty', () => {
    expect(notice.length).toBeGreaterThan(200);
  });

  it('cites every Apache-2.0 tesseract asset family', () => {
    expect(notice).toMatch(/tesseract\.js/);
    expect(notice).toMatch(/tesseract\.js-core/);
    expect(notice).toMatch(/traineddata/);
  });

  it('references the Apache-2.0 license name and canonical URL', () => {
    expect(notice).toMatch(/Apache License,?\s+Version 2\.0/);
    expect(notice).toMatch(/apache\.org\/licenses\/LICENSE-2\.0/);
  });

  it('points re-reviewers at the SECURITY.md section that owns this contract', () => {
    expect(notice).toMatch(/SECURITY\.md.*5/s);
  });
});
