/**
 * Handoff bundle: lease.pdf + findings.html + findings.json + README.txt,
 * packed as a STORE-only ZIP via the shared `buildStoreZip` primitive.
 */

import { buildStoreZip } from './storeZip';

export interface HandoffZipInput {
  pdfBytes: Uint8Array;
  findingsHtml: string;
  findingsJson: string;
  readme: string;
}

export function buildHandoffZip(input: HandoffZipInput): Uint8Array {
  const enc = new TextEncoder();
  return buildStoreZip([
    { name: 'lease.pdf', data: input.pdfBytes },
    { name: 'findings.html', data: enc.encode(input.findingsHtml) },
    { name: 'findings.json', data: enc.encode(input.findingsJson) },
    { name: 'README.txt', data: enc.encode(input.readme) },
  ]);
}
