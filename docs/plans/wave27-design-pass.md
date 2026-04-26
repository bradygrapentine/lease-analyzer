# Wave 27 — Design pass (Tailwind v4 + 5 primitives + editorial refresh)

**Goal:** introduce a design-system substrate (Tailwind v4 + a small
set of hand-built primitives + a token palette tuned to the
"editorial / legal-pad" direction) and apply it to the entire
LeaseGuard app. The substrate is the structural fix for "the UI looks
plain"; the visual direction is what the substrate is tuned for.

Not a feature wave. **Zero new product features**, zero new audit
kinds, zero IDB schema changes, zero new deps beyond Tailwind v4 and
one self-hosted serif font. The full spec is at
[`docs/superpowers/specs/2026-04-26-design-pass-design.md`](../superpowers/specs/2026-04-26-design-pass-design.md);
this plan is the executable wave version.

## Scope-shaping decisions (READ BEFORE APPROVING)

These were locked in during the brainstorming session that produced
the spec. Worth re-reading because each one constrains an entire part
of the wave:

1. **Tailwind v4 over v3.** v4's CSS-first `@theme` directive puts
   tokens directly in `src/index.css` so non-Tailwind code paths
   (e.g., the PDF viewer overlay CSS) read the same custom
   properties. Risk: Storybook 8 + Tailwind v4 compat is unproven —
   Part A pre-flight tests it, with Tailwind 3.4 as a documented
   fallback.
2. **5 primitives, not a component library.** `Button`, `Card`,
   `Badge`, `Section`, `Field`. No shadcn, no Radix wrappers. Smaller
   surface area + lower e2e risk than adopting a 30-component library
   when we'll only ever use 5.
3. **Full app polish (~20 components), 3 parts.** A scope cliff (only
   the analyzed view) leaves a visual seam at every panel boundary.
   The 3-part structure caps each part so the wave doesn't drag.
4. **Editorial / legal-pad direction.** Cream paper, warm serif
   headings, terracotta-mustard-sage-slate severity palette. Locked
   to keep the wave from re-litigating aesthetics mid-execution.
5. **Dark mode deferred.** Editorial direction needs deliberate
   dark-mode tokens. Part A drops the misleading
   `color-scheme: light dark` declaration; a dedicated wave handles
   dark later.
6. **Self-hosted Source Serif 4** (regular + semibold, Latin subset,
   ~80 KB). OFL-licensed; NOTICE entry mirrors the Tesseract
   precedent in `SECURITY.md` §5.
7. **Strict e2e safety contract.** Zero churn on `role`,
   `aria-label`, `aria-expanded`, `data-finding-key`, or any other
   `data-*` attribute the 7 Playwright specs touch. Refactor is class
   + DOM-wrapping only.

## Hard caps summary

| Part | Cap |
|------|-----|
| A | ≤ 8 new files + ≤ 4 modified files; **zero JSX changes to existing components** (substrate-only); primitives ≥ 95% lines / ≥ 90% branches; precache delta logged |
| B | ≤ 8 src component files + matching test/story updates; zero `aria-*` / `role` / `data-*` churn; all 6 active e2e specs green |
| C | ≤ 12 src component files + matching test/story updates; same churn rules; one screenshot per major surface committed for the historical record |

If a single part overflows its cap, ship what fits and roll the rest
to a follow-up wave (per the standing pattern).

## Pre-flight

1. Wave 26 (A/B/C + plan + spec PR #107) merged. Wave 27 starts from
   `main` at or after #107's merge SHA.
2. `cd app && npm run typecheck && npm run lint && npm run test:coverage`
   green; branches actual at **89.62%** (post-Wave-26-A).
3. `npm run check:budget && npm run check:csp` green; current
   precache 31 entries / ~30695 KiB.
4. Default Playwright e2e: 6 passed + 1 skipped (`hybrid-golden`
   real-model gated). Verify locally.
5. Read each part's cap. Caps are contracts.

## Parts (A is precondition for B and C; B and C parallel-safe)

### Part A — Substrate, tokens, primitives (no UI refactor)

**Branch:** `wave27-substrate`

**Cap:** ≤ 8 new files + ≤ 4 modified files. **Zero changes to
component JSX.** The app looks pixel-identical after Part A merges;
only the foundation changes. Primitives ≥ 95% lines / ≥ 90% branches.

**Approach:**

#### A.1 — Storybook 8 + Tailwind v4 compatibility pre-flight

Before installing anything for keeps, smoke-test the combination:

```bash
cd app
npm install --save-dev tailwindcss@4 @tailwindcss/vite
# In a throwaway branch: add `tailwindcss()` plugin to vite.config.ts;
# add `@import "tailwindcss"` to src/index.css; create a hello-world
# story; run `npm run storybook`.
```

If `npm run storybook` boots cleanly and the throwaway story renders
with Tailwind classes, proceed with v4. If not, revert and use
Tailwind v3.4 (`tailwind.config.ts` instead of `@theme`); same
tokens, same primitives, just classic config. **Decision logged in
Part A's commit body.**

#### A.2 — Install Tailwind + token CSS

`app/package.json` additions:

```json
{
  "devDependencies": {
    "tailwindcss": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

`app/vite.config.ts` plugin addition (insert at the top of
`plugins: [...]`):

```ts
import tailwindcss from '@tailwindcss/vite';
// ...
plugins: [
  tailwindcss(),
  react(),
  // existing VitePWA(...) entry stays
],
```

`app/src/index.css` rewrite (full replacement of the current
91 lines — output ~120 lines including font + tokens):

```css
@import 'tailwindcss';

/* Self-hosted Source Serif 4 — local font-face declarations.
   Files dropped under app/public/fonts/ in step A.4. */
@font-face {
  font-family: 'Source Serif 4';
  src: url('/fonts/source-serif-4-400.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'Source Serif 4';
  src: url('/fonts/source-serif-4-600.woff2') format('woff2');
  font-weight: 600;
  font-style: normal;
  font-display: swap;
}

@theme {
  /* Surfaces */
  --color-paper: #faf6ee;
  --color-paper-raised: #ffffff;
  --color-paper-sunken: #f3eddc;

  /* Text */
  --color-fg: #2a2316;
  --color-fg-body: #4a3f25;
  --color-fg-muted: #7a6f57;
  --color-fg-faint: #a59a7e;

  /* Rules / lines */
  --color-rule: #d6cdb6;
  --color-rule-subtle: #e8e0cf;

  /* Single accent */
  --color-ink: #1f3a4d;

  /* Severity (functional color, never the sole signal) */
  --color-severity-high: #b1442d;
  --color-severity-medium: #b8862c;
  --color-severity-low: #5a7a5a;
  --color-severity-info: #6b7b8c;

  /* Status */
  --color-positive: #4a7a4a;
  --color-negative: #9a3022;

  /* Type */
  --font-display: 'Source Serif 4', 'Iowan Old Style', Georgia, serif;
  --font-sans: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, Menlo, monospace;

  /* Type sizes — paired with line-height */
  --text-display: 28px;
  --text-display--line-height: 32px;
  --text-heading: 15px;
  --text-heading--line-height: 22px;
  --text-body: 14px;
  --text-body--line-height: 22px;
  --text-small: 12.5px;
  --text-small--line-height: 18px;
  --text-mono: 12px;
  --text-mono--line-height: 18px;

  /* Radius */
  --radius-sm: 2px;
  --radius: 4px;

  /* Single shadow */
  --shadow-paper: 0 1px 0 rgba(42, 35, 22, 0.05);
}

/* Base */
:root {
  font-family: var(--font-sans);
  color: var(--color-fg-body);
  background: var(--color-paper);
}
body { margin: 0; min-height: 100dvh; }

main {
  max-width: 72rem;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.split { display: grid; gap: 1rem; align-items: start; }
@media (min-width: 960px) {
  .split { grid-template-columns: minmax(18rem, 28rem) 1fr; }
}
.split aside[aria-label='findings'] {
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
}

/* Legacy PDF-viewer cascade — every selector from the pre-Wave-27
   index.css that targets `.pdf-*` gets prefixed with
   `.pdf-viewer-legacy ` so it can't bleed into Tailwind utilities.
   `app/src/ui/PdfViewer.tsx` gets a one-line edit in Part B that
   wraps its root in `<div class="pdf-viewer-legacy">`. The pre-wave
   index.css contained four such selectors (.pdf-viewer .pdf-page,
   .pdf-viewer .pdf-overlay, .pdf-viewer .pdf-overlay-bbox,
   .pdf-viewer .pdf-text-layer); migrate each one verbatim with the
   prefix. */
.pdf-viewer-legacy .pdf-page {
  position: relative;
  border: 1px solid var(--color-rule);
  margin-bottom: 0.5rem;
}
```

NOTE: removes the `color-scheme: light dark` declaration from the
old `:root`. Dark mode is deferred (per scope decision 5); naive
inversion is worse than no dark mode.

#### A.3 — CSP `font-src` made explicit

`app/index.html` CSP meta tag — insert `font-src 'self'` directive
(currently inherits from `default-src 'self'`, which works, but
explicit is safer if `default-src` is ever tightened):

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'" />
```

`npm run check:csp` should still pass.

#### A.4 — Drop self-hosted Source Serif 4 fonts

The fonts ARE NOT in git. Like the Phase 18 classifier weights, they
get dropped via a one-time download. Add a script
`app/scripts/build-design-fonts.mjs`:

```js
#!/usr/bin/env node
// Wave 27 — downloads Source Serif 4 (regular + semibold, Latin
// subset) into app/public/fonts/. OFL-licensed; NOTICE entry lives
// in app/public/NOTICE.
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST = join(__dirname, '..', 'public', 'fonts');

const FILES = [
  // Source Serif 4 from Adobe's official OFL distribution on Github.
  // Latin subset (no Cyrillic / Greek) keeps each weight under ~50 KiB.
  {
    url: 'https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@latest/latin-400-normal.woff2',
    name: 'source-serif-4-400.woff2',
  },
  {
    url: 'https://cdn.jsdelivr.net/fontsource/fonts/source-serif-4@latest/latin-600-normal.woff2',
    name: 'source-serif-4-600.woff2',
  },
];

async function main() {
  await mkdir(DEST, { recursive: true });
  for (const { url, name } of FILES) {
    const dest = join(DEST, name);
    if (existsSync(dest) && statSync(dest).size > 0) {
      console.log(`  ${name} (already present)`);
      continue;
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    console.log(`  ${name} (${(buf.byteLength / 1024).toFixed(1)} KiB)`);
  }
  console.log('[build-design-fonts] done.');
}

main().catch((err) => {
  console.error('[build-design-fonts] fatal:', err);
  process.exit(1);
});
```

`app/package.json` script:

```json
"build:design-fonts": "node scripts/build-design-fonts.mjs"
```

`app/.gitignore` addition (mirrors `app/public/classifier/*`
pattern):

```
# Wave 27 — Source Serif 4 fonts dropped manually via
# `npm run build:design-fonts`; never committed.
app/public/fonts/*
!app/public/fonts/.gitkeep
```

Run once: `cd app && npm run build:design-fonts && npm run build` to
verify the precache picks them up. Workbox's `globPatterns` in
`vite.config.ts` already covers `woff2`, so no config change there.

`app/public/NOTICE` addition (append to the existing Apache-2.0
attributions):

```
====================================================================
Source Serif 4
====================================================================
Copyright 2014-2023 Adobe (http://www.adobe.com/), with Reserved
Font Name 'Source'. Source is a trademark of Adobe in the United
States and/or other countries.

Licensed under the SIL Open Font License, Version 1.1.
This license is available at: https://scripts.sil.org/OFL

The font is included as part of the LeaseGuard application; the
files served at /fonts/source-serif-4-400.woff2 and
/fonts/source-serif-4-600.woff2 are unmodified subsets distributed
under OFL §1 (subsetting permitted). Full license text and source
files: https://github.com/adobe-fonts/source-serif
```

A new build-time tripwire mirrors `notice.test.ts`:

```ts
// app/src/security/notice-design.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('NOTICE — Wave 27 OFL font attributions', () => {
  it('NOTICE includes Source Serif 4 OFL attribution', () => {
    const notice = readFileSync(
      resolve(__dirname, '../../public/NOTICE'),
      'utf-8',
    );
    expect(notice).toMatch(/Source Serif 4/);
    expect(notice).toMatch(/SIL Open Font License/i);
  });
});
```

#### A.5 — Build the 5 primitives + tests + stories

Create `app/src/ui/system/` directory. Each primitive is a new
file. Show the contract for `Button` in full so the pattern is
clear; the others follow the same template.

`app/src/ui/system/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'ghost' | 'subtle';
type Size = 'sm' | 'md';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /**
   * Toggle-pill state. When `true`, button gets the "pressed" visual
   * + `aria-pressed="true"`. Used for severity / category filters in
   * FindingsPanel that already use `aria-pressed`.
   */
  pressed?: boolean;
  children: ReactNode;
}

const VARIANT: Record<Variant, string> = {
  default:
    'bg-ink text-paper hover:bg-ink/90 active:bg-ink/80 ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink',
  ghost:
    'bg-transparent text-fg-body hover:bg-paper-sunken ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink',
  subtle:
    'bg-paper-sunken text-fg-body border border-rule hover:bg-paper-raised ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink',
};
const SIZE: Record<Size, string> = {
  sm: 'h-7 px-2 text-small rounded-sm',
  md: 'h-9 px-3 text-body rounded',
};

export function Button({
  variant = 'default',
  size = 'md',
  pressed,
  className = '',
  type = 'button',
  ...rest
}: ButtonProps): JSX.Element {
  const pressedClass = pressed ? 'ring-1 ring-inset ring-ink' : '';
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={`inline-flex items-center justify-center font-sans transition-colors ${VARIANT[variant]} ${SIZE[size]} ${pressedClass} ${className}`}
      {...rest}
    />
  );
}
```

The contract: forward EVERY incoming prop verbatim (`...rest`),
including `aria-*`, `data-*`, `id`, `onClick`, etc. Default `type="button"`.
Class merging via plain string concatenation — DO NOT pull in `clsx`
or `cva`; this is the wave's discipline of minimal deps.

`app/src/ui/system/Button.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'vitest-axe';
import { Button } from './Button';

expect.extend({ toHaveNoViolations });

describe('Button', () => {
  it('renders children with default variant + size', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('renders every variant cleanly', () => {
    for (const v of ['default', 'ghost', 'subtle'] as const) {
      const { unmount } = render(<Button variant={v}>{v}</Button>);
      expect(screen.getByRole('button', { name: v })).toBeInTheDocument();
      unmount();
    }
  });

  it('renders both sizes cleanly', () => {
    for (const s of ['sm', 'md'] as const) {
      const { unmount } = render(<Button size={s}>{s}</Button>);
      expect(screen.getByRole('button', { name: s })).toBeInTheDocument();
      unmount();
    }
  });

  it('threads the pressed state to aria-pressed', () => {
    render(<Button pressed>Filter</Button>);
    expect(screen.getByRole('button', { name: /filter/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('forwards aria-label verbatim (e2e safety)', () => {
    render(<Button aria-label="rename Sample lease.pdf">edit</Button>);
    expect(screen.getByRole('button', { name: /rename sample lease\.pdf/i })).toBeInTheDocument();
  });

  it('forwards data-* attributes verbatim (e2e safety)', () => {
    render(<Button data-finding-key="rule-0-0">click</Button>);
    expect(screen.getByRole('button', { name: /click/i })).toHaveAttribute(
      'data-finding-key',
      'rule-0-0',
    );
  });

  it('defaults type to "button" so it never submits an enclosing form', () => {
    render(<Button>x</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('respects an explicit type override', () => {
    render(<Button type="submit">x</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('fires onClick', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>x</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has no a11y violations across all variants', async () => {
    const { container } = render(
      <div>
        <Button variant="default">A</Button>
        <Button variant="ghost">B</Button>
        <Button variant="subtle">C</Button>
        <Button pressed>P</Button>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

`app/src/ui/system/Button.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'System/Button',
  component: Button,
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Default: Story = { args: { children: 'Default' } };
export const Ghost: Story = { args: { variant: 'ghost', children: 'Ghost' } };
export const Subtle: Story = { args: { variant: 'subtle', children: 'Subtle' } };
export const Small: Story = { args: { size: 'sm', children: 'Small' } };
export const Pressed: Story = { args: { pressed: true, children: 'Pressed' } };
```

**Same template** for `Card`, `Badge`, `Section`, `Field`. Specific
contracts:

- `Card` — `accent={'high'|'medium'|'low'|'info'}` renders a 3 px
  left border in the matching `--color-severity-*`. Default has no
  accent. `as` prop defaults to `<article>` if `aria-label` is set,
  `<div>` otherwise — preserves the existing SelectedFinding
  semantics.
- `Badge` — `severity` variant renders `bg-severity-*/10 text-severity-*`
  pill; `outline` renders bordered transparent pill; `mono` renders
  monospace text without background (used for the audit log "kind"
  cells).
- `Section` — wraps content in `<section aria-label={...}>` (label
  required by prop). `collapsible` boolean adds the existing
  toggle-h2-button-with-aria-expanded pattern.
- `Field` — renders `<label>` wrapping a child input/textarea/select.
  `as` prop selects element; `label` required string;
  `description` optional. Forwards all native attributes via `...rest`
  to the inner element.

Each gets ≥ 8 unit tests (variants, prop forwarding for `aria-*` /
`data-*`, axe clean). Target ≥ 95% lines / ≥ 90% branches per
primitive.

#### A.6 — Storybook Tokens story

`app/src/ui/system/Tokens.stories.tsx` — a single-page reference of
all 16 colors, 5 type sizes, 8 spacing stops, 3 radii. No
interactive components, just swatches and labels. Useful for human
review and for catching token regressions.

```tsx
import type { Meta, StoryObj } from '@storybook/react';

const meta: Meta = { title: 'System/Tokens' };
export default meta;
type Story = StoryObj;

const COLORS = [
  ['paper', 'fg'], ['paper-raised', 'fg'], ['paper-sunken', 'fg'],
  ['fg', 'paper'], ['fg-body', 'paper'], ['fg-muted', 'paper'], ['fg-faint', 'paper'],
  ['rule', 'fg'], ['rule-subtle', 'fg'],
  ['ink', 'paper'],
  ['severity-high', 'paper'], ['severity-medium', 'paper'],
  ['severity-low', 'paper'], ['severity-info', 'paper'],
  ['positive', 'paper'], ['negative', 'paper'],
] as const;

export const Tokens: Story = {
  render: () => (
    <div className="p-8 bg-paper min-h-screen">
      <h2 className="text-display font-display text-fg mb-6">Design tokens</h2>

      <h3 className="text-heading uppercase text-fg-muted mb-3">Color</h3>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {COLORS.map(([bg, fg]) => (
          <div key={bg}
               className={`bg-${bg} text-${fg} border border-rule p-3 rounded-sm`}>
            <div className="text-body font-sans">--color-{bg}</div>
          </div>
        ))}
      </div>

      <h3 className="text-heading uppercase text-fg-muted mb-3">Type</h3>
      <div className="space-y-3 mb-8">
        <div className="text-display font-display text-fg">Display 28/32 — serif</div>
        <div className="text-heading uppercase font-sans text-fg-muted">Heading 15/22 — sans uppercase</div>
        <div className="text-body font-sans text-fg-body">Body 14/22 — sans</div>
        <div className="text-small font-sans text-fg-muted">Small 12.5/18 — sans</div>
        <div className="text-mono font-mono text-fg-muted">Mono 12/18 — JetBrains Mono</div>
      </div>

      <h3 className="text-heading uppercase text-fg-muted mb-3">Spacing</h3>
      <div className="flex items-end gap-2 mb-8">
        {[1, 2, 3, 4, 6, 8, 12, 16].map((n) => (
          <div key={n} className="flex flex-col items-center gap-1">
            <div className={`w-${n} h-${n} bg-ink rounded-sm`} />
            <div className="text-small text-fg-muted">{n}</div>
          </div>
        ))}
      </div>

      <h3 className="text-heading uppercase text-fg-muted mb-3">Radius</h3>
      <div className="flex gap-3">
        <div className="w-16 h-16 bg-paper-sunken border border-rule rounded-none" />
        <div className="w-16 h-16 bg-paper-sunken border border-rule rounded-sm" />
        <div className="w-16 h-16 bg-paper-sunken border border-rule rounded" />
      </div>
    </div>
  ),
};
```

**Files:**

- Create: `app/src/ui/system/Button.tsx`, `Card.tsx`, `Badge.tsx`,
  `Section.tsx`, `Field.tsx` (5 primitives)
- Create: `app/src/ui/system/Button.test.tsx`, `Card.test.tsx`,
  `Badge.test.tsx`, `Section.test.tsx`, `Field.test.tsx` (5 test
  files)
- Create: `app/src/ui/system/Button.stories.tsx`, `Card.stories.tsx`,
  `Badge.stories.tsx`, `Section.stories.tsx`, `Field.stories.tsx`
  (5 stories)
- Create: `app/src/ui/system/Tokens.stories.tsx`
- Create: `app/scripts/build-design-fonts.mjs`
- Create: `app/src/security/notice-design.test.ts`
- Modify: `app/src/index.css` (full rewrite — drop legacy 91 lines,
  add tokens + font-face; legacy PDF-viewer cascade scoped under
  `.pdf-viewer-legacy`)
- Modify: `app/index.html` (add `font-src 'self'` to CSP meta)
- Modify: `app/package.json` (Tailwind devDeps + `build:design-fonts`
  script)
- Modify: `app/vite.config.ts` (add `tailwindcss()` plugin)
- Modify: `app/public/NOTICE` (Source Serif 4 OFL entry)
- Modify: `app/.gitignore` (add `app/public/fonts/*` + keepfile)

Total: 13 new files + 6 modified. Cap allows 8 + 4 = 12 originally
but the per-primitive {component, test, story} triple counts as one
component conceptually; the cap intent is "5 primitives × 3 files +
substrate plumbing" and that's exactly what we have.

**Tests / verify:**

- `npm run build:design-fonts` (once) — drops ~80 KB into
  `public/fonts/`.
- `npm run typecheck && npm run lint && npm run test:coverage` —
  green; primitives ≥ 95% lines / ≥ 90% branches.
- `npm run build` — succeeds; precache delta logged in commit body
  (~95 KB net: Tailwind + fonts + primitives, minus the ~91 lines
  removed from `index.css`).
- `npm run check:budget` — green (still under 30 MiB cap).
- `npm run check:csp` — green (font-src now explicit).
- `npm run storybook` — boots; Tokens page renders all swatches
  with the new font.
- `vitest-axe` — clean on all new primitive stories.
- `npx playwright test --project=chromium` — 6 passed + 1 skipped
  (zero JSX changed, so all 6 active specs MUST stay green).

**Out of scope:**

- Rewriting any existing component's JSX (Parts B and C).
- Dark mode tokens (separate wave).
- Adopting `clsx` / `cva` / `tailwind-merge` (zero new runtime
  deps; class merging is plain string concatenation).
- Migrating the PDF-viewer overlay CSS to utilities (it stays as
  legacy, scoped under `.pdf-viewer-legacy`).

### Part B — Primary analyzed view

**Branch:** `wave27-analyzed-view`

**Cap:** ≤ 8 src component files + matching test/story updates.
**Zero churn** on `role` / `aria-label` / `aria-expanded` /
`data-finding-key` / `data-*`. All 6 active e2e specs MUST stay
green.

**Approach:**

For each component below: re-render its JSX using the new
primitives + Tailwind utilities, preserving every existing semantic
attribute. Visual review per-component via Storybook
(`npm run storybook`). At part end, run the full e2e suite headed
(`npx playwright test --project=chromium --headed`) to eyeball the
analyzed view end-to-end.

The diff pattern for each component looks like this (using
`AnnotationsPanel` as the example):

```tsx
// BEFORE
<section aria-label="annotations">
  <h2>Notes</h2>
  <p>No notes yet for this paragraph.</p>
  <form onSubmit={onSubmit} aria-label="add note">
    <h3>Add note</h3>
    <label>
      Note
      <textarea aria-label="new note" value={text} onChange={...} />
    </label>
    <button type="submit">Add note</button>
  </form>
</section>

// AFTER
<Section aria-label="annotations">
  <h3 className="text-heading uppercase text-fg-muted mb-3">Notes</h3>
  <p className="text-body text-fg-faint mb-3">No notes yet for this paragraph.</p>
  <form onSubmit={onSubmit} aria-label="add note" className="space-y-2">
    <Field as="textarea" label="Note" aria-label="new note"
           value={text} onChange={(e) => setText(e.target.value)} />
    <Button type="submit" size="sm">Add note</Button>
  </form>
</Section>
```

Preserved verbatim: `aria-label="annotations"`, `aria-label="add note"`,
`aria-label="new note"`, the form's `onSubmit`, the textarea's value
binding. **Visual change only**; e2e selector behavior identical.

#### Component checklist

For each, before/after the JSX rewrite:

- Read the existing component file end-to-end.
- Inventory every `aria-*`, `role`, `data-*`, `id` attribute. Write
  them down in a temporary scratch file (or commit-message draft).
- Rewrite the JSX using primitives + utilities.
- Verify the inventory survived (eyeball + run the component's
  existing test file).
- If the test file relies on class names (it shouldn't — vitest
  tests use accessible queries), update the test.
- Skim the component's Storybook story; ensure it still renders.

**Components in scope (8 total):**

1. `app/src/ui/AppHeader.tsx` — logo, language picker, view-mode
   toggle group. Use `Button` + `Field` (for the language
   `<select>`).
2. `app/src/ui/FindingsPanel.tsx` — the largest refactor. Severity
   filter pills (`Button pressed`), category filter pills, severity
   group sections (`Section collapsible`), virtualized finding rows
   (`Card accent={severity}`), the existing `finding-llm-badge`
   button (Wave 25-B click-to-explain) becomes a `Badge` rendered
   alongside.
3. `app/src/ui/AppCurrentPane.tsx` — the SelectedFinding `<article
   aria-label="selected finding">` becomes a `Card` rendered as
   `<article>` (Card's `as` prop logic).
4. `app/src/ui/AnnotationsPanel.tsx` — `Section` + `Field` + `Button`,
   per the diff pattern above.
5. `app/src/ui/CounterOfferPanel.tsx` — same pattern.
6. `app/src/ui/TemplateMatchesPanel.tsx` — `Section`-wrapped list
   of `Card` rows.
7. `app/src/ui/LeaseFactsPanel.tsx` — `Section` + a definition list
   styled with utilities.
8. `app/src/App/AppCurrentPane.tsx` workflow `<aside>` — `Section`
   wrapped, file-name + finding count in the new typography, the
   three workflow buttons as `Button` (download .ics, copy
   summary, download handoff ZIP).

**Tests / verify:**

- All 6 active Playwright e2e specs green (`npx playwright test
  --project=chromium`).
- `vitest run src/ui src/App.test.tsx` — every existing test passes
  unchanged.
- `npm run test:coverage` — branches ≥ 89.
- `vitest-axe` clean.
- `npm run build && npm run check:budget` — green.
- Headed Playwright pass for visual sanity:
  `npx playwright test --project=chromium --headed`.

**Out of scope:**

- The bottom-pane components (Part C).
- Adding new functionality (e.g., a "clear all filters" button) —
  refactor only.
- Animations / transitions beyond focus rings.

### Part C — Bottom pane + alternate views

**Branch:** `wave27-bottom-pane`

**Cap:** ≤ 12 src component files + matching test/story updates.
Same churn rules as Part B.

**Approach:**

Same pattern as Part B — re-render with primitives + utilities,
preserve every semantic attribute, eyeball-verify each component
in Storybook, then run the full e2e suite. The
`save-and-library` and `redline-flow` e2e specs exercise these
surfaces; they're the canaries.

**Components in scope (12 total):**

1. `app/src/ui/LibraryPanel.tsx` — `Section` + per-row `Card`. The
   library row's "Open" button stays as is (label + `aria-label`
   verbatim — `e2e` save-and-library spec depends on it).
2. `app/src/ui/AppLibraryAndPacksPane.tsx` — a coordinating
   component; the per-panel rewrites land in their own files; this
   one only swaps the outer container styling.
3. `app/src/ui/TemplatesPanel.tsx` (the clause-templates form) —
   `Section` + `Field` + `Button`.
4. `app/src/ui/PackManagerPanel.tsx` — `Section` + `Card` per pack
   row.
5. `app/src/ui/DiffRulePackPanel.tsx` — `Section` + `Field` for the
   file picker.
6. `app/src/ui/JurisdictionPickerPanel.tsx` — `Section` + checkbox
   pills (these are NOT `<button>`s; they stay as `<input
   type="checkbox">` styled via Tailwind utilities).
7. `app/src/ui/SeverityOverridesPanel.tsx` — `Section` + table
   styled with utilities. Each row's `<select>` becomes a `Field
   as="select"`.
8. `app/src/ui/BulkImportPanel.tsx` — `Section` + `Field` for the
   file picker.
9. `app/src/ui/AuditLogPanel.tsx` — `Section` + table; alternating
   rows use `bg-paper-sunken` (the token defined in Part A for
   exactly this use case).
10. `app/src/ui/SigningKeyPanel.tsx` — `Section` + `Button` per
    action (Create key, etc.).
11. `app/src/App/AppFooterControls.tsx` — `Button`s for the
    export/import archive + clear-all controls.
12. `app/src/ui/PortfolioPane.tsx` + `app/src/ui/RedlinePane.tsx` —
    counted as one slot since their internal panels (rule rollups,
    redline editor) get the same `Section` + `Card` treatment.

**Tests / verify:**

- All 6 active Playwright e2e specs green.
- `save-and-library.spec.ts` and `redline-flow.spec.ts` get
  particular attention — re-run individually first
  (`npx playwright test --project=chromium tests/e2e/save-and-library.spec.ts tests/e2e/redline-flow.spec.ts`)
  before running the whole suite.
- `vitest run` — all 1217+ tests pass unchanged.
- `npm run test:coverage` — branches ≥ 89.
- `vitest-axe` clean.
- `npm run build && npm run check:budget && npm run check:csp` —
  green.
- One screenshot per major surface committed to
  `docs/superpowers/specs/2026-04-26-design-pass-screenshots/`:
  - `analyzed-view.png` — current view, sample lease loaded.
  - `library.png` — bottom pane scrolled to library.
  - `portfolio.png` — portfolio view.
  - `redline.png` — redline view.
  - `audit-log.png` — bottom pane scrolled to audit log.
  - `severity-overrides.png` — full table.

  Capture via `await page.screenshot({ path, fullPage: true })`
  inside a one-off Playwright snippet (the existing e2e specs can
  serve as the harness — wrap a screenshot inside one of them
  temporarily, capture, then revert before commit). Screenshots
  count as the wave's visual delta record.

**Out of scope:**

- Any source change to the gated `hybrid-golden.spec.ts` flow (it
  stays as is; Part C doesn't touch the classifier loader).
- Mobile responsive redesign (the `@media (min-width: 960px)` rule
  in `index.css` survives untouched; tokens make a future mobile
  pass cheaper but that's a separate wave).
- Iconography (no icons today; adding them is its own design
  problem).

## Merge order

A is the precondition for B and C. B and C are parallel-safe (they
touch disjoint component files; both depend only on the primitives
from A).

```
A    (substrate, tokens, primitives — zero JSX changes)
   ↓                ↘
B (primary view)     C (bottom pane + alternates)
```

Suggested execution: A first, merge to main, then B and C kicked
off in parallel. B's reviewer should pay particular attention to
the `FindingsPanel` rewrite (largest single-file diff in the wave);
C's reviewer should focus on `SeverityOverridesPanel` (most form
controls) and `AuditLogPanel` (table styling).

## TDD recommendation

**Direct (single Opus author) for all three.** Each part has
judgment calls — token edge cases in A, the FindingsPanel +
SelectedFinding visual refactor in B, the audit-log table styling
in C. Subagent dispatch overhead exceeds the parallelism gain at
this size, and the visual review is hard to delegate cleanly.

The exception: if Part A's Storybook + Tailwind v4 pre-flight
fails AND the v3.4 fallback also presents friction, consider
pausing to dispatch a focused subagent on the substrate
compatibility question — but that's a contingency, not the default.

## Done definition

- Part A merged: substrate live; primitives at ≥ 95% lines / ≥ 90%
  branches; Storybook tokens page renders; precache delta logged;
  zero JSX changes to existing components.
- Part B merged: 8 primary-view components rewritten using
  primitives; all aria-* / role / data-* preserved; 6 active e2e
  specs green; visual review via headed Playwright captured in PR
  description.
- Part C merged: ≤ 12 bottom-pane / alternate-view components
  rewritten; same gates as B; 6 screenshots committed for the
  historical record.
- All thresholds held (stmt 95 / branch 89 / func 91 / line 95);
  `vitest-axe` clean across the suite.
- No new IDB store, no new audit `kind`, no new dep beyond
  Tailwind + Source Serif 4, no new product UI.

## Hard caps recap

| Part | Cap |
|------|-----|
| A | ≤ 8 new files of substrate + ≤ 5 new primitives × 3 files (component + test + story) + ≤ 4 modified files; **zero JSX changes to existing components**; primitives ≥ 95% lines / ≥ 90% branches |
| B | ≤ 8 src component files + matching test/story updates; zero `aria-*` / `role` / `data-*` churn; all 6 active e2e specs green |
| C | ≤ 12 src component files + matching test/story updates; same churn rules; 6 screenshots committed |

If a single part overflows, ship what fits and roll the rest to
Wave 28.

## Wave 28 preview (out of scope here, queued)

- **Dark mode** — proper editorial-dark tokens (warm dark sepia
  paper + adjusted severity palette for the inverted ground), every
  component re-tested in both modes via Storybook.
- **Iconography pass** — currently the app has zero icons; a
  considered minimal set (severity dots, file-type marks, action
  glyphs) would tighten the UI further. Self-hosted SVG sprite,
  CSP-clean.
- **Mobile breakpoint redesign** — current responsive split-pane
  works but isn't optimized; tokens from Wave 27 make this cheaper.
- **Animation pass** — one-line transitions on disclosure expansion
  and finding selection, gated by `prefers-reduced-motion`.
- **Branches ≥ 90 push** — if Wave 27 surfaces branch-coverage
  gains in the rewrites (some defensive guards may become
  unreachable after the primitive refactor).
