import { describe, it, expect } from 'vitest';
import {
  exportEncryptedArchive,
  importEncryptedArchive,
  WrongPassphraseError,
} from './archive';
import type { LeaseRecord } from './storage';

function makeRecord(id: string, name: string): LeaseRecord {
  return {
    id,
    name,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    rulePackVersion: '1.0.0',
    pageCount: 1,
    findingCount: 0,
    doc: { pages: [], paragraphs: [{ text: 'hi', page: 1 }], sections: [], raw: 'hi' },
    findings: [],
  };
}

describe('encrypted archive', () => {
  it('round-trips leases and standardId with the correct passphrase', async () => {
    const leases = [makeRecord('a', 'A.pdf'), makeRecord('b', 'B.pdf')];
    const bytes = await exportEncryptedArchive(leases, 'a', 'hunter2');
    const restored = await importEncryptedArchive(bytes, 'hunter2');
    expect(restored.leases).toEqual(leases);
    expect(restored.standardId).toBe('a');
  });

  it('rejects import with a wrong passphrase', async () => {
    const bytes = await exportEncryptedArchive([makeRecord('a', 'A.pdf')], null, 'correct');
    await expect(importEncryptedArchive(bytes, 'wrong')).rejects.toBeInstanceOf(
      WrongPassphraseError,
    );
  });

  it('rejects tampered bytes', async () => {
    const bytes = await exportEncryptedArchive([makeRecord('a', 'A.pdf')], null, 'p');
    const last = bytes.length - 1;
    bytes[last] = (bytes[last] ?? 0) ^ 0xff;
    await expect(importEncryptedArchive(bytes, 'p')).rejects.toBeInstanceOf(
      WrongPassphraseError,
    );
  });

  it('rejects a blob with the wrong magic header', async () => {
    const bogus = new Uint8Array(32);
    await expect(importEncryptedArchive(bogus, 'p')).rejects.toThrow(/not.*archive/i);
  });
});
