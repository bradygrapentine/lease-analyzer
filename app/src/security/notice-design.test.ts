// app/src/security/notice-design.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('NOTICE — Wave 27 OFL font attributions', () => {
  it('NOTICE includes Source Serif 4 OFL attribution', () => {
    const notice = readFileSync(
      resolve(__dirname, '../../public/NOTICE'),
      'utf-8',
    );
    expect(notice).toMatch(/Source Serif 4/);
    expect(notice).toMatch(/SIL Open Font License/i);
  });
});
