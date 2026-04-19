import { describe, expect, it } from 'vitest';
import { makePdf } from '../parser/testFixtures';
import { RULE_PACK_V1 } from '../rules/packV1';
import { createInlinePipelineClient } from './inlinePipeline';

async function makeBytes(): Promise<Uint8Array> {
  return makePdf([
    {
      blocks: [{ text: 'This lease shall auto-renew annually.', x: 72, y: 72 }],
    },
  ]);
}

describe('createInlinePipelineClient', () => {
  it('parseAndAnalyze resolves to { doc, findings } for a valid PDF', async () => {
    const client = createInlinePipelineClient();
    const bytes = await makeBytes();
    const out = await client.parseAndAnalyze(bytes, RULE_PACK_V1, '1.0.0');
    expect(out.doc.pages.length).toBeGreaterThan(0);
    expect(out.findings.length).toBeGreaterThan(0);
    client.terminate();
  });

  it('parseAndAnalyze rejects when parseLease throws', async () => {
    const client = createInlinePipelineClient();
    await expect(client.parseAndAnalyze(new Uint8Array([1, 2, 3]), RULE_PACK_V1)).rejects.toThrow();
  });

  it('two in-flight requests resolve independently', async () => {
    const client = createInlinePipelineClient();
    const bytes1 = await makeBytes();
    const bytes2 = await makeBytes();
    const [a, b] = await Promise.all([
      client.parseAndAnalyze(bytes1, RULE_PACK_V1),
      client.parseAndAnalyze(bytes2, RULE_PACK_V1),
    ]);
    expect(a.doc.pages.length).toBeGreaterThan(0);
    expect(b.doc.pages.length).toBeGreaterThan(0);
  });

  it('terminate is a no-op that does not throw', () => {
    const client = createInlinePipelineClient();
    expect(() => client.terminate()).not.toThrow();
  });
});
