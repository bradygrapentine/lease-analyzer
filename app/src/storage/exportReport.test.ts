import { beforeEach, describe, it, expect } from 'vitest';
import { exportFindingsJson, signExport, verifySignedExport } from './exportReport';
import type { LeaseDocument } from '../parser/types';
import type { Finding } from '../rules/types';
import {
  createSigningKey,
  _resetSigningDbForTests,
  SIGNING_DB_NAME,
} from '../security/signingKeys';

async function wipeSigningDb(): Promise<void> {
  await _resetSigningDbForTests();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(SIGNING_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

function f(over: Partial<Finding>): Finding {
  return {
    ruleId: 'auto-renewal',
    severity: 'medium',
    category: 'termination',
    title: 'Auto-renewal',
    explanation: 'Test',
    citation: null,
    page: 1,
    paragraphIndex: 0,
    snippet: 'snippet',
    span: { start: 0, end: 7 },
    confidence: 0.9,
    negated: false,
    rulePackVersion: '1.0.0',
    ...over,
  };
}

function doc(): LeaseDocument {
  return {
    pages: [
      { pageNumber: 1, width: 612, height: 792, items: [] },
      { pageNumber: 2, width: 612, height: 792, items: [] },
    ],
    paragraphs: [
      { text: 'a', page: 1 },
      { text: 'b', page: 2 },
    ],
    sections: [],
    raw: 'a\n\nb',
  };
}

describe('exportFindingsJson', () => {
  it('emits a valid JSON string with a schema header', () => {
    const json = exportFindingsJson({ name: 'Lease.pdf', doc: doc(), findings: [f({})] });
    const parsed = JSON.parse(json);
    expect(parsed.schema).toBe('leaseguard.findings.v1');
    expect(parsed.lease.name).toBe('Lease.pdf');
    expect(parsed.lease.pageCount).toBe(2);
    expect(parsed.findings).toHaveLength(1);
    expect(parsed.rulePackVersion).toBe('1.0.0');
  });

  it('is pretty-printed and stable for same input', () => {
    const a = exportFindingsJson({ name: 'X', doc: doc(), findings: [f({})] });
    const b = exportFindingsJson({ name: 'X', doc: doc(), findings: [f({})] });
    expect(a).toBe(b);
    expect(a.includes('\n')).toBe(true);
  });

  it('excludes raw document body from the export', () => {
    const json = exportFindingsJson({ name: 'X', doc: doc(), findings: [] });
    expect(json).not.toContain('"raw"');
  });

  it('handles empty findings', () => {
    const parsed = JSON.parse(exportFindingsJson({ name: 'X', doc: doc(), findings: [] }));
    expect(parsed.findings).toEqual([]);
    expect(parsed.rulePackVersion).toBe(null);
  });

  it('includes inputHash=null by default', () => {
    const parsed = JSON.parse(exportFindingsJson({ name: 'X', doc: doc(), findings: [] }));
    expect(parsed.inputHash).toBeNull();
  });

  it('includes caller-supplied inputHash when provided', () => {
    const hash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const parsed = JSON.parse(
      exportFindingsJson({ name: 'X', doc: doc(), findings: [], inputHash: hash }),
    );
    expect(parsed.inputHash).toBe(hash);
  });
});

describe('signExport / verifySignedExport', () => {
  beforeEach(async () => {
    await wipeSigningDb();
  });

  it('an unsigned export has no signature field and verifySignedExport returns false', async () => {
    const json = exportFindingsJson({ name: 'X', doc: doc(), findings: [f({})] });
    const parsed = JSON.parse(json);
    expect(parsed.signature).toBeUndefined();
    expect(await verifySignedExport(json)).toBe(false);
  });

  it('signExport appends a signature block; verifySignedExport confirms it', async () => {
    await createSigningKey('hunter2');
    const unsigned = exportFindingsJson({ name: 'X', doc: doc(), findings: [f({})] });
    const signed = await signExport(unsigned, 'hunter2');
    const parsed = JSON.parse(signed);
    expect(parsed.signature).toBeDefined();
    expect(parsed.signature.publicKey).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(parsed.signature.signature).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(parsed.signature.signedAt).toMatch(/\d{4}-\d{2}-\d{2}T/);
    // Schema version is stable — signature is an optional extension.
    expect(parsed.schema).toBe('leaseguard.findings.v1');
    expect(await verifySignedExport(signed)).toBe(true);
  });

  it('tampered payload fails verification', async () => {
    await createSigningKey('p');
    const unsigned = exportFindingsJson({ name: 'X', doc: doc(), findings: [f({})] });
    const signed = await signExport(unsigned, 'p');
    const parsed = JSON.parse(signed);
    parsed.lease.name = 'Y'; // Mutate the payload.
    const tampered = JSON.stringify(parsed, null, 2);
    expect(await verifySignedExport(tampered)).toBe(false);
  });

  it('tampered signature fails verification', async () => {
    await createSigningKey('p');
    const unsigned = exportFindingsJson({ name: 'X', doc: doc(), findings: [f({})] });
    const signed = await signExport(unsigned, 'p');
    const parsed = JSON.parse(signed);
    // Flip one byte in the signature by swapping the first base64 char.
    const sig = parsed.signature.signature as string;
    parsed.signature.signature = (sig.startsWith('A') ? 'B' : 'A') + sig.slice(1);
    const bad = JSON.stringify(parsed, null, 2);
    expect(await verifySignedExport(bad)).toBe(false);
  });

  it('refuses to sign an already-signed export', async () => {
    await createSigningKey('p');
    const unsigned = exportFindingsJson({ name: 'X', doc: doc(), findings: [f({})] });
    const signed = await signExport(unsigned, 'p');
    await expect(signExport(signed, 'p')).rejects.toThrow(/already signed/i);
  });
});
