#!/usr/bin/env node
/**
 * leaseguard CLI entry point.
 *
 * Subcommands:
 *   verify       <replay-bundle.zip>                     (Wave 8 Part C)
 *   open-review  <archive.lgreview> --passphrase <pp>    (Wave 9 Part D)
 *                                   [--out <path>]
 *
 * Exit codes (uniform across subcommands):
 *   0  success
 *   1  semantic failure (mismatch / wrong passphrase / expired / tampered)
 *   2  usage / IO error
 *
 * No network. Deterministic-only. See cli/README.md.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyReplay } from './verifyReplay';
import { openReview } from './openReview';

const USAGE =
  'Usage:\n' +
  '  leaseguard verify <replay-bundle.zip>\n' +
  '  leaseguard open-review <archive.lgreview> --passphrase <pp> [--out <path>]\n';

async function runVerify(args: string[]): Promise<number> {
  if (args.length !== 1 || args[0] === '-h' || args[0] === '--help') {
    process.stderr.write(USAGE);
    return args.length === 1 ? 0 : 2;
  }
  const bundlePath = resolve(args[0]!);
  let bytes: Uint8Array;
  try {
    const buf = await readFile(bundlePath);
    bytes = new Uint8Array(buf);
  } catch (err) {
    process.stderr.write(
      `leaseguard verify: cannot read ${bundlePath}: ${(err as Error).message}\n`,
    );
    return 2;
  }
  const result = await verifyReplay(bytes);
  if (result.ok) {
    process.stdout.write(`leaseguard verify: OK — ${bundlePath} reproduces byte-identically.\n`);
    return 0;
  }
  process.stderr.write(`leaseguard verify: MISMATCH — ${bundlePath}\n`);
  process.stderr.write(`${result.diff ?? '(no diff)'}\n`);
  return 1;
}

function parseFlag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  if (i === -1) return undefined;
  const v = args[i + 1];
  return v;
}

async function runOpenReview(args: string[]): Promise<number> {
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    process.stderr.write(USAGE);
    return args.length === 0 ? 2 : 0;
  }
  const archivePath = resolve(args[0]!);
  const passphrase = parseFlag(args, '--passphrase');
  const outPath = parseFlag(args, '--out');
  if (!passphrase) {
    process.stderr.write('leaseguard open-review: --passphrase <pp> is required\n');
    return 2;
  }

  let bytes: Uint8Array;
  try {
    const buf = await readFile(archivePath);
    bytes = new Uint8Array(buf);
  } catch (err) {
    process.stderr.write(
      `leaseguard open-review: cannot read ${archivePath}: ${(err as Error).message}\n`,
    );
    return 2;
  }

  const result = await openReview({ archiveBytes: bytes, passphrase });
  if (result.ok === false) {
    process.stderr.write(
      `leaseguard open-review: FAILED (${result.reason}) — ${result.message}\n`,
    );
    return 1;
  }

  if (outPath) {
    try {
      await writeFile(resolve(outPath), result.bundle);
      process.stdout.write(
        `leaseguard open-review: OK — wrote ${result.bundle.byteLength} bytes to ${outPath}\n` +
          `  packFingerprint: ${result.packFingerprint}\n` +
          `  expiresAt:       ${result.expiresAt}\n`,
      );
    } catch (err) {
      process.stderr.write(
        `leaseguard open-review: cannot write ${outPath}: ${(err as Error).message}\n`,
      );
      return 2;
    }
  } else {
    process.stdout.write(Buffer.from(result.bundle));
  }
  return 0;
}

async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    process.stderr.write(USAGE);
    return args.length === 0 ? 2 : 0;
  }
  const sub = args[0]!;
  const rest = args.slice(1);
  switch (sub) {
    case 'verify':
      return runVerify(rest);
    case 'open-review':
      return runOpenReview(rest);
    default:
      // Back-compat: the original entry was `leaseguard-verify <zip>` with
      // no subcommand. If the first arg looks like a path (ends in .zip),
      // route it to verify so existing scripts keep working.
      if (sub.endsWith('.zip')) {
        return runVerify(args);
      }
      process.stderr.write(`leaseguard: unknown subcommand "${sub}"\n${USAGE}`);
      return 2;
  }
}

main(process.argv).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(`leaseguard: unexpected error: ${(err as Error).stack ?? err}\n`);
    process.exit(2);
  },
);
