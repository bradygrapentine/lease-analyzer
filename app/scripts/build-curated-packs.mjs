#!/usr/bin/env node
// Build the curated-pack marketplace assets:
//   - app/public/packs/curated/<id>.lgpack.json (signed envelopes)
//   - app/public/packs/curated/manifest.json    (typed listing)
//
// Idempotent by construction: every input is fixed (curator key seed,
// pack contents, canonical JSON layout, fingerprint = SHA-256 of
// canonical envelope), so two runs produce byte-identical output.
//
// Privacy contract: the curator's signing key seed is checked into the
// repo intentionally — these packs are public, build-time, and the trust
// hierarchy is "ships with the app" not "issued by a CA". Users who want
// stricter trust can remove these packs and import their own.

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto, createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../public/packs/curated');

// Deterministic curator key. 32-byte Ed25519 seed; encoded as a JWK so
// Node's webcrypto can import it. Public key is derived from the seed.
const CURATOR_SEED_BASE64URL = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8';

const PACKS = [
  {
    schema: 'leaseguard.rulepack.v1',
    id: 'us-ca-residential',
    name: 'California residential (curated)',
    version: '1.0.0',
    description:
      'Curated residential lease checks for California. Bundled with LeaseGuard, signed by the LeaseGuard curator key.',
    rules: [
      {
        id: 'ca-deposit-cap',
        severity: 'medium',
        category: 'finance',
        title: 'Security deposit cap (CA)',
        explanation:
          'California caps residential security deposits. Confirm the deposit does not exceed the statutory limit.',
        citation: null,
        match: {
          type: 'keywordProximity',
          keywords: ['security', 'deposit'],
          window: 40,
        },
      },
      {
        id: 'ca-entry-notice',
        severity: 'low',
        category: 'obligations',
        title: 'Landlord 24-hour entry notice',
        explanation:
          'California requires 24-hour written notice before non-emergency entry.',
        citation: null,
        match: {
          type: 'keywordProximity',
          keywords: ['entry', 'notice'],
          window: 30,
        },
      },
    ],
  },
  {
    schema: 'leaseguard.rulepack.v1',
    id: 'us-ny-commercial',
    name: 'New York commercial (curated)',
    version: '1.0.0',
    description:
      'Curated commercial-lease checks for New York. Bundled with LeaseGuard, signed by the LeaseGuard curator key.',
    rules: [
      {
        id: 'ny-good-guy-guaranty',
        severity: 'high',
        category: 'termination',
        title: 'Good-guy guaranty',
        explanation:
          'Personal guaranty limited to the period the tenant occupies the premises. Common in NY commercial leases.',
        citation: null,
        match: {
          type: 'keywordProximity',
          keywords: ['good', 'guy', 'guaranty'],
          window: 30,
        },
      },
      {
        id: 'ny-cam-charges',
        severity: 'medium',
        category: 'finance',
        title: 'CAM charges',
        explanation:
          'Common-area maintenance pass-throughs. Confirm caps and audit rights.',
        citation: null,
        match: {
          type: 'keywordProximity',
          keywords: ['common', 'area', 'maintenance'],
          window: 25,
        },
      },
    ],
  },
  {
    schema: 'leaseguard.rulepack.v1',
    id: 'us-tx-residential',
    name: 'Texas residential (curated)',
    version: '1.0.0',
    description:
      'Curated residential lease checks for Texas. Bundled with LeaseGuard, signed by the LeaseGuard curator key.',
    rules: [
      {
        id: 'tx-late-fee',
        severity: 'medium',
        category: 'finance',
        title: 'Late fee reasonableness',
        explanation:
          'Texas requires late fees to be reasonable. Confirm the percentage and grace period are within statutory guidance.',
        citation: null,
        match: {
          type: 'keywordProximity',
          keywords: ['late', 'fee'],
          window: 25,
        },
      },
      {
        id: 'tx-repair-remedies',
        severity: 'high',
        category: 'obligations',
        title: 'Repair remedies (Property Code §92)',
        explanation:
          'Texas Property Code §92 grants tenants specific repair remedies. Watch for waivers.',
        citation: null,
        match: {
          type: 'keywordProximity',
          keywords: ['repair', 'remedy'],
          window: 30,
        },
      },
    ],
  },
];

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out = {};
  for (const k of Object.keys(value).sort()) {
    out[k] = canonicalize(value[k]);
  }
  return out;
}

function canonicalJsonStringify(value) {
  return JSON.stringify(canonicalize(value));
}

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64');
}

function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function importCuratorKeys() {
  // JWK with deterministic seed. Web Crypto derives the public key.
  const jwkPriv = {
    kty: 'OKP',
    crv: 'Ed25519',
    d: CURATOR_SEED_BASE64URL,
    // x is required by some implementations; derive via a temporary
    // generate+sign would defeat determinism. Compute x once, hardcode below.
    x: 'A6EHv_POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg',
  };
  const privateKey = await webcrypto.subtle.importKey(
    'jwk',
    jwkPriv,
    { name: 'Ed25519' },
    true,
    ['sign'],
  );
  const jwkPub = { kty: jwkPriv.kty, crv: jwkPriv.crv, x: jwkPriv.x };
  const publicKey = await webcrypto.subtle.importKey(
    'jwk',
    jwkPub,
    { name: 'Ed25519' },
    true,
    ['verify'],
  );
  return { privateKey, publicKey };
}

async function signPack(pack, privateKey, publicKey) {
  const payload = canonicalJsonStringify(pack);
  const sig = new Uint8Array(
    await webcrypto.subtle.sign(
      'Ed25519',
      privateKey,
      new TextEncoder().encode(payload),
    ),
  );
  const spki = new Uint8Array(
    await webcrypto.subtle.exportKey('spki', publicKey),
  );
  return {
    payload,
    signature: bytesToBase64(sig),
    publicKey: bytesToBase64(spki),
    algorithm: 'Ed25519',
  };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const { privateKey, publicKey } = await importCuratorKeys();
  const manifest = [];

  for (const pack of PACKS) {
    const envelope = await signPack(pack, privateKey, publicKey);
    // Canonical bytes for both file and fingerprint — deterministic.
    const envelopeJson = `${canonicalJsonStringify(envelope)}\n`;
    const fingerprint = sha256Hex(envelopeJson.trimEnd());
    const fileName = `${pack.id}.lgpack.json`;
    const filePath = resolve(OUT_DIR, fileName);
    await writeFile(filePath, envelopeJson);

    manifest.push({
      id: pack.id,
      name: pack.name,
      description: pack.description,
      jurisdictions: jurisdictionsFor(pack.id),
      author: 'LeaseGuard core',
      fingerprint,
      path: `/packs/curated/${fileName}`,
    });
  }

  const manifestJson = `${canonicalJsonStringify(manifest)}\n`;
  await writeFile(resolve(OUT_DIR, 'manifest.json'), manifestJson);
  console.log(
    `wrote ${manifest.length} curated packs + manifest.json to ${OUT_DIR}`,
  );
}

function jurisdictionsFor(id) {
  if (id.startsWith('us-ca')) return ['US-CA'];
  if (id.startsWith('us-ny')) return ['US-NY'];
  if (id.startsWith('us-tx')) return ['US-TX'];
  return [];
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
