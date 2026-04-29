// Wave 45-A — policy test enforcing DESIGN.md Don't #1 ("no side-stripe
// borders > 1px"). Reads every JSX file under app/src/ui and fails the
// suite if any className string contains a `border-l-N` or `border-r-N`
// (or arbitrary-px equivalent) where N > 1.
//
// Single-px hairlines are allowed and are how the system signals
// blockquote / mono quote stripes. Anything thicker is the legacy
// pattern that this wave retired; the policy keeps it retired.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// vitest runs from the `app/` workspace root, so `process.cwd()` resolves
// to `app/`. Avoid `import.meta.url` here — vite serves source files via
// http-style URLs in the test environment, which trips fileURLToPath.
const UI_ROOT = join(process.cwd(), 'src', 'ui');

// border-l-2, border-l-3, …, border-l-99 (Tailwind shorthand)
// border-l-[2px], border-l-[3px], …, border-l-[99px] (arbitrary)
// Same patterns for border-r. Captures the offending number for assertion
// output, not for any branch logic — the test fails on any match.
const FORBIDDEN = /\bborder-(l|r)-(?:(\[[2-9]\d*px\])|([2-9]\d*))\b/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      walk(full, out);
    } else if (entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe("no-side-stripe policy (DESIGN.md Don't #1)", () => {
  it('no JSX file in app/src/ui uses border-l or border-r > 1px', () => {
    const files = walk(UI_ROOT);
    const violations: { file: string; line: number; match: string }[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const lines = text.split('\n');
      lines.forEach((line, i) => {
        // Skip lines that are obviously comments (single-line // and block
        // comment bodies). The policy targets className/string literals,
        // and an inline regex inside a JSDoc is not a violation.
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        let m: RegExpExecArray | null;
        FORBIDDEN.lastIndex = 0;
        while ((m = FORBIDDEN.exec(line)) !== null) {
          violations.push({
            file: file.slice(file.indexOf('app/src/')),
            line: i + 1,
            match: m[0],
          });
        }
      });
    }
    if (violations.length > 0) {
      const summary = violations.map((v) => `  ${v.file}:${v.line} — ${v.match}`).join('\n');
      throw new Error(
        `Side-stripe policy violation(s):\n${summary}\n\nUse <Card variant="severity-…"> + <Badge variant="severity"> instead. See DESIGN.md §5 / §6.`,
      );
    }
    expect(violations).toHaveLength(0);
  });
});
