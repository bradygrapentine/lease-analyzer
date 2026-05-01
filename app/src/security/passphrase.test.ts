import { describe, it, expect } from 'vitest';
import { MIN_PASSPHRASE_LEN } from './passphrase';

describe('passphrase constants', () => {
  it('MIN_PASSPHRASE_LEN is 16', () => {
    expect(MIN_PASSPHRASE_LEN).toBe(16);
  });
});
