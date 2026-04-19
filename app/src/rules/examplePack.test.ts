import { describe, it, expect } from 'vitest';
import exampleStarter from '../../public/packs/example-starter.lgpack.json';
import { validatePackFile } from './packSchema';

describe('example-starter.lgpack.json', () => {
  it('validates against the rule-pack schema', () => {
    const result = validatePackFile(exampleStarter);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(`example pack invalid:\n${result.errors.join('\n')}`);
    }
    expect(result.pack.rules.length).toBeGreaterThanOrEqual(2);
    expect(result.pack.rules.length).toBeLessThanOrEqual(5);
  });
});
