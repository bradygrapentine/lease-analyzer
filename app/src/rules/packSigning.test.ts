import { describe, it, expect } from 'vitest';
import { signPack, verifySignedPack, type SignedPackEnvelope } from './packSigning';
import { RULE_PACK_SCHEMA_VERSION, type RulePackFile } from './packSchema';

function makePack(overrides: Partial<RulePackFile> = {}): RulePackFile {
  return {
    schema: RULE_PACK_SCHEMA_VERSION,
    id: 'signed-pack',
    name: 'Signed pack',
    version: '1.0.0',
    description: 'A pack that will be signed in tests.',
    rules: [
      {
        id: 'signed-pack-r1',
        severity: 'low',
        category: 'general',
        title: 'Rule',
        explanation: 'explanation',
        citation: null,
        match: { type: 'regex', pattern: 'hello', flags: 'i' },
      },
    ],
    ...overrides,
  };
}

async function freshKeypair(): Promise<CryptoKeyPair> {
  return (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
}

describe('packSigning', () => {
  it('signPack + verifySignedPack round-trips a well-formed pack', async () => {
    const kp = await freshKeypair();
    const pack = makePack();
    const envelope = await signPack(pack, kp.privateKey, kp.publicKey);
    expect(envelope.algorithm).toBe('Ed25519');
    expect(envelope.payload.length).toBeGreaterThan(0);
    expect(envelope.signature).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(envelope.publicKey).toMatch(/^[A-Za-z0-9+/=]+$/);

    const result = await verifySignedPack(envelope);
    expect(result.ok).toBe(true);
    expect(result.pack?.id).toBe('signed-pack');
    expect(result.reason).toBeUndefined();
  });

  it('canonical JSON is stable regardless of input key order', async () => {
    const kp = await freshKeypair();
    const a = makePack();
    // Same pack but rebuilt with keys in a different insertion order.
    const b: RulePackFile = {
      rules: a.rules,
      description: a.description,
      version: a.version,
      name: a.name,
      id: a.id,
      schema: a.schema,
    };
    const envA = await signPack(a, kp.privateKey, kp.publicKey);
    const envB = await signPack(b, kp.privateKey, kp.publicKey);
    expect(envA.payload).toBe(envB.payload);
  });

  it('rejects a tampered payload', async () => {
    const kp = await freshKeypair();
    const envelope = await signPack(makePack(), kp.privateKey, kp.publicKey);
    const tampered: SignedPackEnvelope = {
      ...envelope,
      payload: envelope.payload.replace('Signed pack', 'Evil pack'),
    };
    const result = await verifySignedPack(tampered);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/signature does not verify/i);
  });

  it('rejects a tampered signature', async () => {
    const kp = await freshKeypair();
    const envelope = await signPack(makePack(), kp.privateKey, kp.publicKey);
    // Flip a byte of the signature by swapping first char with last.
    const sig = envelope.signature;
    const tamperedSig =
      sig.length > 1 ? sig.slice(-1) + sig.slice(1, -1) + sig.slice(0, 1) : sig;
    const result = await verifySignedPack({ ...envelope, signature: tamperedSig });
    expect(result.ok).toBe(false);
  });

  it('rejects when algorithm is missing or unexpected', async () => {
    const kp = await freshKeypair();
    const envelope = await signPack(makePack(), kp.privateKey, kp.publicKey);
    const r1 = await verifySignedPack({ ...envelope, algorithm: 'RSA' });
    expect(r1.ok).toBe(false);
    expect(r1.reason).toMatch(/algorithm/i);
    const { algorithm: _omit, ...noAlg } = envelope;
    void _omit;
    const r2 = await verifySignedPack(noAlg);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toMatch(/algorithm/i);
  });

  it('rejects when required fields are missing or wrong shape', async () => {
    const kp = await freshKeypair();
    const envelope = await signPack(makePack(), kp.privateKey, kp.publicKey);
    expect((await verifySignedPack(null)).ok).toBe(false);
    expect((await verifySignedPack('not-an-object')).ok).toBe(false);
    expect((await verifySignedPack({ ...envelope, payload: '' })).ok).toBe(false);
    expect((await verifySignedPack({ ...envelope, signature: '' })).ok).toBe(false);
    expect((await verifySignedPack({ ...envelope, publicKey: '' })).ok).toBe(false);
  });

  it('rejects when publicKey is not valid SPKI', async () => {
    const kp = await freshKeypair();
    const envelope = await signPack(makePack(), kp.privateKey, kp.publicKey);
    const bogus = btoa('not-a-real-spki-blob');
    const result = await verifySignedPack({ ...envelope, publicKey: bogus });
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/spki|publicKey/i);
  });

  it('rejects when signature/publicKey is not valid base64', async () => {
    const kp = await freshKeypair();
    const envelope = await signPack(makePack(), kp.privateKey, kp.publicKey);
    const result = await verifySignedPack({
      ...envelope,
      signature: '!!!not-base64!!!',
    });
    expect(result.ok).toBe(false);
    // Either the base64 check or the verify itself can trip first; both
    // are acceptable failures.
    expect(result.reason).toBeTruthy();
  });

  it('rejects when payload parses but fails pack-schema validation', async () => {
    // Sign a JSON blob that is valid JSON but not a valid pack, then
    // hand-roll an envelope around it.
    const kp = await freshKeypair();
    const bogusPayload = JSON.stringify({ schema: 'not-a-pack' });
    const bytes = new TextEncoder().encode(bogusPayload);
    const sig = new Uint8Array(
      await crypto.subtle.sign('Ed25519', kp.privateKey, bytes as BufferSource),
    );
    const spki = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey));
    const envelope: SignedPackEnvelope = {
      payload: bogusPayload,
      signature: bytesToBase64(sig),
      publicKey: bytesToBase64(spki),
      algorithm: 'Ed25519',
    };
    const result = await verifySignedPack(envelope);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not a valid pack/i);
  });

  it('rejects when payload is not valid JSON', async () => {
    const kp = await freshKeypair();
    const bogusPayload = '{not json';
    const bytes = new TextEncoder().encode(bogusPayload);
    const sig = new Uint8Array(
      await crypto.subtle.sign('Ed25519', kp.privateKey, bytes as BufferSource),
    );
    const spki = new Uint8Array(await crypto.subtle.exportKey('spki', kp.publicKey));
    const envelope: SignedPackEnvelope = {
      payload: bogusPayload,
      signature: bytesToBase64(sig),
      publicKey: bytesToBase64(spki),
      algorithm: 'Ed25519',
    };
    const result = await verifySignedPack(envelope);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/not valid json/i);
  });
});

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(bin);
}
