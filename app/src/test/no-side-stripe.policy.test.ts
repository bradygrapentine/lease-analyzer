// Wave 45-A — policy test enforcing DESIGN.md Don't #1 ("no side-stripe
// borders > 1px"). Two passes:
//
//   1. JSX className side-stripes (`border-l-N` / `border-r-N`, N > 1)
//      across every .tsx file under app/src/ui.
//   2. Inline-CSS side-stripes (`border-left: Npx …` / `border-right:
//      Npx …`, N > 1) across every .ts/.tsx file under app/src — catches
//      the export-HTML codepath (redline, exportHtml, sideLetter) that
//      the JSX-only sweep used to miss.
//
// 1px hairlines are allowed everywhere; anything thicker is the legacy
// pattern this wave retired.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_ROOT = join(process.cwd(), 'src');
const UI_ROOT = join(SRC_ROOT, 'ui');

// border-l-2, …, border-l-[3px], … and same for -r. Tailwind shorthand
// or arbitrary-px. Captures the offending fragment for assertion output.
const FORBIDDEN_TW = /\bborder-(l|r)-(?:(\[[2-9]\d*px\])|([2-9]\d*))\b/g;
// border-left: 2px …, border-right: 3px …, etc. CSS strings inside .ts
// files (the export codepath emits inline <style> blocks).
const FORBIDDEN_CSS = /\bborder-(left|right)\s*:\s*[2-9]\d*px\b/g;

function walk(dir: string, out: string[] = [], extensions: readonly string[] = ['.tsx']): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      walk(full, out, extensions);
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

interface Violation {
  file: string;
  line: number;
  match: string;
}

function scan(files: string[], pattern: RegExp): Violation[] {
  const violations: Violation[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
      let m: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((m = pattern.exec(line)) !== null) {
        violations.push({
          file: file.slice(file.indexOf('app/src/')),
          line: i + 1,
          match: m[0],
        });
      }
    });
  }
  return violations;
}

describe("no-side-stripe policy (DESIGN.md Don't #1)", () => {
  it('no JSX file in app/src/ui uses border-l or border-r > 1px', () => {
    const violations = scan(walk(UI_ROOT, []), FORBIDDEN_TW);
    if (violations.length > 0) {
      const summary = violations.map((v) => `  ${v.file}:${v.line} — ${v.match}`).join('\n');
      throw new Error(
        `Side-stripe policy violation(s):\n${summary}\n\nUse <Card variant="severity-…"> + <Badge variant="severity"> instead. See DESIGN.md §5 / §6.`,
      );
    }
    expect(violations).toHaveLength(0);
  });

  it('no inline CSS string in app/src uses border-left/right > 1px', () => {
    const files = walk(SRC_ROOT, [], ['.ts', '.tsx']).filter(
      (f) => !f.endsWith('.test.ts') && !f.endsWith('.test.tsx') && !f.endsWith('.stories.tsx'),
    );
    const violations = scan(files, FORBIDDEN_CSS);
    if (violations.length > 0) {
      const summary = violations.map((v) => `  ${v.file}:${v.line} — ${v.match}`).join('\n');
      throw new Error(
        `Inline-CSS side-stripe violation(s):\n${summary}\n\nReplace with full-perimeter 1px hairline + tonal background, or remove the stripe entirely. See DESIGN.md §6 (No-Side-Stripe Rule).`,
      );
    }
    expect(violations).toHaveLength(0);
  });
});
