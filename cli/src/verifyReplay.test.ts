import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
// Wave 8 Part C — module under test does not yet exist; failing import
// is the expected red signal until the implementer creates
// `cli/src/verifyReplay.ts` exporting:
//   verifyReplay(bundleBytes: Uint8Array): Promise<{ ok: boolean; diff?: string }>
import { verifyReplay } from './verifyReplay';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dirname, '../fixtures/sample-replay.zip');

async function loadFixture(): Promise<Uint8Array> {
  const buf = await readFile(FIXTURE);
  return new Uint8Array(buf);
}

describe('verifyReplay', () => {
  it('exits ok=true on a byte-identical reproduction (canonical fixture)', async () => {
    // Will fail with ENOENT until the implementer adds the fixture, OR
    // with a "not implemented" error from the verifyReplay stub.
    const bytes = await loadFixture();
    const result = await verifyReplay(bytes);
    expect(result.ok).toBe(true);
  });

  it('exits ok=false with a diff when the expected.json inside the bundle is perturbed', async () => {
    const original = await loadFixture();
    // Flip a byte deep in the archive — almost certainly inside a
    // STORE-only payload, so it will perturb the expected output.
    const perturbed = new Uint8Array(original);
    const idx = Math.max(0, perturbed.length - 64);
    const at = perturbed[idx] ?? 0;
    perturbed[idx] = (at ^ 0x01) & 0xff;
    const result = await verifyReplay(perturbed);
    expect(result.ok).toBe(false);
    expect(typeof result.diff).toBe('string');
    expect((result.diff ?? '').length).toBeGreaterThan(0);
  });

  it('does NOT pull pdf.js worker code paths into the node-side import graph', async () => {
    // The verifyReplay module must use a node-side parser entry. We can't
    // statically introspect the module graph from a runtime test without
    // tooling, so this assertion is a smoke-check: importing the module
    // must succeed in pure node (no `Worker`, no DOM).
    const mod = await import('./verifyReplay');
    expect(typeof mod.verifyReplay).toBe('function');
  });
});
