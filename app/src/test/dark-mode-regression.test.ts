// Wave 32-B — palette-class regression test.
//
// Wave 31-B shipped a tri-state theme toggle that overrides the
// semantic --color-* tokens under [data-theme="dark"]. Components that
// use Tailwind's raw palette utilities (bg-amber-50, text-zinc-700,
// etc.) bypass the token cascade and look wrong in dark mode. This
// test scans the source tree at test time and fails on any such
// usage outside an explicit allow-list. Pure-Node implementation —
// no execSync, no shell tooling required.
//
// To allow-list a file legitimately, add the project-relative path
// to ALLOW_LIST_PATHS with a one-line comment explaining why.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const FORBIDDEN =
  /\b(bg|text|border|ring|outline|fill|stroke|from|to|via)-(amber|stone|zinc|slate|neutral|gray|red|orange|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-\d+)?(\/\d+)?\b/;

// Hybrid-finding disclosure surface — owned by Wave 32 Part C; this
// regression intentionally skips those files so Part C's wave can edit
// them without tripping. Tighten via a follow-up once C lands and any
// remaining hard-coded classes there are cleaned up.
const ALLOW_LIST_PATHS: ReadonlyArray<string> = [
  'src/ui/HybridFeedbackButton.tsx',
  'src/ui/HybridPrecisionPanel.tsx',
  'src/ui/FindingsPanel.tsx',
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

function isExcluded(rel: string): boolean {
  const normalized = rel.split(sep).join('/');
  return ALLOW_LIST_PATHS.some((p) => normalized === p);
}

describe('dark-mode regression: no hard-coded palette colors in components', () => {
  it('finds zero forbidden Tailwind palette classes in app/src outside the allow list', () => {
    // Vitest cwd in this project is `app/`, so walk `src/` directly.
    const root = resolve('src');
    const offenders: Array<{ file: string; line: number; text: string }> = [];
    for (const path of walk(root)) {
      if (!/\.(tsx|ts)$/.test(path)) continue;
      if (/\.test\.tsx?$/.test(path)) continue;
      if (/\.stories\.tsx?$/.test(path)) continue;
      const rel = relative(resolve('.'), path);
      if (isExcluded(rel)) continue;
      const lines = readFileSync(path, 'utf8').split('\n');
      lines.forEach((text, i) => {
        if (FORBIDDEN.test(text)) {
          offenders.push({ file: rel, line: i + 1, text: text.trim() });
        }
      });
    }
    const formatted = offenders
      .map((o) => `${o.file}:${o.line}  ${o.text}`)
      .join('\n');
    expect(
      offenders,
      `Found hard-coded Tailwind palette classes:\n${formatted}`,
    ).toEqual([]);
  });
});
