// Wave 32-B — palette-class regression test.
// Wave 34-C — extended with three additional static checks that close
// the gaps the original Tailwind-utility scan missed: arbitrary-value
// hex (`bg-[#fff]`), inline-style hex (`style={{ color: '#...' }}`),
// and SVG attribute hex (`fill="#..."`). All three would render the
// same color in light and dark, defeating the [data-theme="dark"]
// token cascade. The existing palette-class allow-list pattern is
// reused for legitimate exemptions (notably the static-HTML export
// modules, which emit standalone documents that are intentionally
// light-only).
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

const PALETTE_CLASS =
  /\b(bg|text|border|ring|outline|fill|stroke|from|to|via)-(amber|stone|zinc|slate|neutral|gray|red|orange|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-\d+)?(\/\d+)?\b/;

// Tailwind arbitrary value with a hex literal:
// `bg-[#fff]`, `text-[#a1b2c3]`, `border-[#abcdef99]`, etc.
const ARBITRARY_HEX =
  /\b(bg|text|border|ring|outline|fill|stroke|from|to|via|shadow|decoration)-\[#[0-9a-fA-F]{3,8}\]/;

// Inline-style hex on a color-bearing key:
// `style={{ color: '#fff' }}`, `style={{ background: "#abc" }}`, etc.
// We match the key, optional whitespace, ':' or '=', a quote, then '#'.
const INLINE_STYLE_HEX =
  /\b(color|background(?:Color)?|fill|stroke|borderColor|outlineColor)\s*[:=]\s*['"`]#[0-9a-fA-F]{3,8}/;

// SVG attribute with a hex literal: `fill="#fff"`, `stroke='#abc'`.
const SVG_ATTR_HEX = /\b(fill|stroke)=['"]#[0-9a-fA-F]{3,8}['"]/;

// Wave 33-C verified all three previously-allow-listed files are clean
// of palette classes. Wave 34-C re-confirms the palette-class allow-list
// is empty.
const ALLOW_LIST_PATHS: ReadonlyArray<string> = [];

// Files that intentionally emit static HTML for the user to download
// or print — those documents are standalone artefacts, not in-app UI,
// so light-only colors are correct and the cascade does not apply.
// Allowlisted for the hex/SVG checks only; palette-class scan still
// runs against them (none currently fire).
const HEX_ALLOW_LIST_PATHS: ReadonlyArray<string> = [
  'src/storage/exportHtml.ts', // findings-export HTML download
  'src/redline/redline.ts', // redline-export HTML download
  'src/negotiation/sideLetter.ts', // side-letter HTML download
];

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

function isExcluded(rel: string, allowList: ReadonlyArray<string>): boolean {
  const normalized = rel.split(sep).join('/');
  return allowList.some((p) => normalized === p);
}

interface Offender {
  file: string;
  line: number;
  text: string;
}

function scan(
  pattern: RegExp,
  allowList: ReadonlyArray<string>,
): Offender[] {
  // Vitest cwd in this project is `app/`, so walk `src/` directly.
  const root = resolve('src');
  const offenders: Offender[] = [];
  for (const path of walk(root)) {
    if (!/\.(tsx|ts)$/.test(path)) continue;
    if (/\.test\.tsx?$/.test(path)) continue;
    if (/\.stories\.tsx?$/.test(path)) continue;
    const rel = relative(resolve('.'), path);
    if (isExcluded(rel, allowList)) continue;
    const lines = readFileSync(path, 'utf8').split('\n');
    lines.forEach((text, i) => {
      if (pattern.test(text)) {
        offenders.push({ file: rel, line: i + 1, text: text.trim() });
      }
    });
  }
  return offenders;
}

function format(offenders: Offender[]): string {
  return offenders.map((o) => `${o.file}:${o.line}  ${o.text}`).join('\n');
}

describe('dark-mode regression: source-level color-literal checks', () => {
  it('finds zero forbidden Tailwind palette classes outside the allow list', () => {
    const offenders = scan(PALETTE_CLASS, ALLOW_LIST_PATHS);
    expect(
      offenders,
      `Found hard-coded Tailwind palette classes:\n${format(offenders)}`,
    ).toEqual([]);
  });

  it('finds zero Tailwind arbitrary-value hex literals (bg-[#xxx], text-[#xxx], ...)', () => {
    const offenders = scan(ARBITRARY_HEX, HEX_ALLOW_LIST_PATHS);
    expect(
      offenders,
      `Found hard-coded hex in Tailwind arbitrary values:\n${format(offenders)}`,
    ).toEqual([]);
  });

  it('finds zero inline style hex literals (style={{ color: "#xxx", ... }})', () => {
    const offenders = scan(INLINE_STYLE_HEX, HEX_ALLOW_LIST_PATHS);
    expect(
      offenders,
      `Found hard-coded hex in inline style props:\n${format(offenders)}`,
    ).toEqual([]);
  });

  it('finds zero SVG attribute hex literals (fill="#xxx", stroke="#xxx")', () => {
    const offenders = scan(SVG_ATTR_HEX, HEX_ALLOW_LIST_PATHS);
    expect(
      offenders,
      `Found hard-coded hex in SVG attributes:\n${format(offenders)}`,
    ).toEqual([]);
  });
});
