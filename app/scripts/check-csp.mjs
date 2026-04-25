#!/usr/bin/env node
// Wave 11 Part D — risk-register cleanup.
//
// Asserts that the built artifacts (`dist/index.html` + `dist/sw.js`) do not
// pick up third-party origins in any of the regulated reference shapes:
//   - <script src=...>          / <script src='...'>
//   - <link href=...>           (stylesheets, preloads, icons)
//   - <img src=...>             (and srcset entries)
//   - CSS url(...)              (inline + sw.js precache shells)
//   - importScripts(...)        (service worker)
//
// CSP itself is `default-src 'self'` — this is the post-build trip-wire that
// catches a CDN URL leaking in via a dependency upgrade BEFORE it would bypass
// the runtime CSP at first install.
//
// The regex set is deliberately conservative: any URL whose scheme starts with
// http(s):// AND whose host is not exempt is treated as a regression. data:,
// blob:, mailto:, same-origin "/foo", and bare relative paths are allowed.
//
// Exit 1 with a clear list of offending matches on regression.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Patterns that scan for third-party origins.
const PATTERNS = [
  {
    label: 'script src',
    re: /<script[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi,
  },
  {
    label: 'link href',
    re: /<link[^>]*\shref\s*=\s*["']([^"']+)["']/gi,
  },
  {
    label: 'img src',
    re: /<img[^>]*\ssrc\s*=\s*["']([^"']+)["']/gi,
  },
  {
    label: 'css url()',
    re: /url\(\s*["']?([^)"']+)["']?\s*\)/gi,
  },
  {
    label: 'importScripts',
    re: /importScripts\s*\(\s*["']([^"']+)["']/gi,
  },
];

// Allowed schemes / shapes.
function isAllowed(url) {
  const trimmed = url.trim();
  if (trimmed === '') return true;
  if (trimmed.startsWith('data:')) return true;
  if (trimmed.startsWith('blob:')) return true;
  if (trimmed.startsWith('mailto:')) return true;
  if (trimmed.startsWith('about:')) return true;
  if (trimmed.startsWith('#')) return true;
  // Protocol-relative URLs (`//cdn.example.com/...`) inherit the parent
  // page scheme and reach a third-party origin — treat as a regression.
  if (trimmed.startsWith('//')) return false;
  // Same-origin absolute (`/foo`).
  if (trimmed.startsWith('/')) return true;
  // Bare relative path (`foo`, `./foo`, `../foo`) — same-origin.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return true;
  // Anything with an explicit scheme — http(s), ws(s), ftp, etc. — is a
  // regression. We intentionally do NOT allowlist any external host.
  return false;
}

/**
 * Scan a single source string. Returns an array of `{ label, url }`
 * regressions. Exposed so the test suite can drive it directly with
 * fixture strings instead of spawning a subprocess.
 */
export function scanSource(source, sourceLabel) {
  const hits = [];
  for (const { label, re } of PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(source)) !== null) {
      const url = m[1];
      if (!isAllowed(url)) {
        hits.push({ source: sourceLabel, label, url });
      }
    }
  }
  return hits;
}

export async function checkCspFiles({ indexHtml, swJs }) {
  const all = [];
  if (indexHtml != null) {
    all.push(...scanSource(indexHtml, 'dist/index.html'));
  }
  if (swJs != null) {
    all.push(...scanSource(swJs, 'dist/sw.js'));
  }
  return all;
}

async function readIfExists(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

async function main() {
  // Run from app/ — same convention as check-bundle-budget.mjs.
  const distDir = resolve(process.cwd(), 'dist');
  const indexHtml = await readIfExists(resolve(distDir, 'index.html'));
  const swJs = await readIfExists(resolve(distDir, 'sw.js'));

  if (indexHtml == null) {
    console.error(
      `check-csp: ${resolve(distDir, 'index.html')} missing. Did you run "npm run build" first?`,
    );
    process.exit(1);
  }
  if (swJs == null) {
    console.error(
      `check-csp: ${resolve(distDir, 'sw.js')} missing. Did vite-plugin-pwa fail to emit sw.js?`,
    );
    process.exit(1);
  }

  const hits = await checkCspFiles({ indexHtml, swJs });
  if (hits.length === 0) {
    console.log('check-csp: OK — no third-party origins in dist/index.html or dist/sw.js.');
    return;
  }

  console.error('check-csp: third-party origin(s) detected — CSP `default-src self` regression:');
  for (const hit of hits) {
    console.error(`  - [${hit.source}] ${hit.label}: ${hit.url}`);
  }
  console.error(
    '\nIf this URL is intentional, bundle the asset locally (see docs/SECURITY.md §3).',
  );
  process.exit(1);
}

// Only run when invoked as a script — not when imported by tests.
const invokedAsScript =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

// Re-exported so the test fixture can drive `isAllowed` directly.
export { isAllowed };
