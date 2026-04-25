#!/usr/bin/env node
/**
 * leaseguard-verify <replay-bundle.zip>
 *
 * Exit 0 on byte-identical reproduction.
 * Exit 1 on mismatch, with a plain-text diff on stderr.
 * Exit 2 on usage / IO error.
 *
 * No network. Deterministic-only. See cli/README.md.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyReplay } from './verifyReplay';

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  if (args.length !== 1 || args[0] === '-h' || args[0] === '--help') {
    process.stderr.write(
      'Usage: leaseguard-verify <replay-bundle.zip>\n' +
        '  Verifies a LeaseGuard .replay.zip by re-running parseLease + analyze\n' +
        '  on the bundled lease.pdf with the bundled pack.lgpack.json, and\n' +
        '  comparing the result to the bundled expected.json.\n' +
        '  Exit 0 on match, 1 on mismatch (with diff), 2 on usage error.\n',
    );
    return args.length === 1 ? 0 : 2;
  }

  const bundlePath = resolve(args[0]!);
  let bytes: Uint8Array;
  try {
    const buf = await readFile(bundlePath);
    bytes = new Uint8Array(buf);
  } catch (err) {
    process.stderr.write(`leaseguard-verify: cannot read ${bundlePath}: ${(err as Error).message}\n`);
    return 2;
  }

  const result = await verifyReplay(bytes);
  if (result.ok) {
    process.stdout.write(`leaseguard-verify: OK — ${bundlePath} reproduces byte-identically.\n`);
    return 0;
  }
  process.stderr.write(`leaseguard-verify: MISMATCH — ${bundlePath}\n`);
  process.stderr.write(`${result.diff ?? '(no diff)'}\n`);
  return 1;
}

main(process.argv).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`leaseguard-verify: unexpected error: ${(err as Error).stack ?? err}\n`);
    process.exit(2);
  },
);
