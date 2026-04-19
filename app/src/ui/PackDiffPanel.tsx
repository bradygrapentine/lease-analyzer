import { useState } from 'react';
import type { PackDiff, ChangedRuleDiff, DiffField } from '../rules/packDiff';
import type { Rule } from '../rules/types';

interface PackDiffPanelProps {
  /** Output of `diffPack(current, incoming)` from `rules/packDiff.ts`. */
  diff: PackDiff;
}

type SectionKey = 'added' | 'removed' | 'changed';

const SECTION_LABEL: Record<SectionKey, string> = {
  added: 'Added',
  removed: 'Removed',
  changed: 'Changed',
};

export function PackDiffPanel({ diff }: PackDiffPanelProps): JSX.Element {
  const [collapsed, setCollapsed] = useState<Set<SectionKey>>(new Set());

  function toggle(key: SectionKey): void {
    const next = new Set(collapsed);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setCollapsed(next);
  }

  const totalChanges = diff.added.length + diff.removed.length + diff.changed.length;

  return (
    <section aria-label="rule pack diff">
      <h2>Pack diff</h2>
      {totalChanges === 0 && (
        <p>
          <em>No changes. The incoming pack matches the current rule set.</em>
        </p>
      )}

      <Section
        keyId="added"
        count={diff.added.length}
        collapsed={collapsed.has('added')}
        onToggle={toggle}
      >
        {diff.added.length === 0 ? (
          <p>
            <em>No rules added.</em>
          </p>
        ) : (
          <ul>
            {diff.added.map((r) => (
              <li key={r.id}>
                <RuleHeader rule={r} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        keyId="removed"
        count={diff.removed.length}
        collapsed={collapsed.has('removed')}
        onToggle={toggle}
      >
        {diff.removed.length === 0 ? (
          <p>
            <em>No rules removed.</em>
          </p>
        ) : (
          <ul>
            {diff.removed.map((r) => (
              <li key={r.id}>
                <RuleHeader rule={r} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        keyId="changed"
        count={diff.changed.length}
        collapsed={collapsed.has('changed')}
        onToggle={toggle}
      >
        {diff.changed.length === 0 ? (
          <p>
            <em>No rules changed.</em>
          </p>
        ) : (
          <ul>
            {diff.changed.map((c) => (
              <li key={c.ruleId}>
                <ChangedEntry entry={c} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </section>
  );
}

interface SectionProps {
  keyId: SectionKey;
  count: number;
  collapsed: boolean;
  onToggle: (k: SectionKey) => void;
  children: React.ReactNode;
}

function Section({
  keyId,
  count,
  collapsed,
  onToggle,
  children,
}: SectionProps): JSX.Element {
  const headingId = `packdiff-${keyId}-heading`;
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-label={`toggle ${keyId} section`}
          onClick={() => onToggle(keyId)}
        >
          {SECTION_LABEL[keyId]} ({count})
        </button>
      </h3>
      {!collapsed && children}
    </section>
  );
}

function RuleHeader({ rule }: { rule: Rule }): JSX.Element {
  return (
    <div>
      <strong>{rule.title}</strong>{' '}
      <small>
        {rule.id} · {rule.severity} · {rule.category}
      </small>
    </div>
  );
}

function ChangedEntry({ entry }: { entry: ChangedRuleDiff }): JSX.Element {
  return (
    <article aria-label={`changed rule ${entry.ruleId}`}>
      <div>
        <strong>{entry.after.title}</strong> <small>{entry.ruleId}</small>
      </div>
      <ul aria-label={`changed fields for ${entry.ruleId}`}>
        {entry.fields.map((field) => (
          <li key={field}>
            <FieldDiff field={field} before={entry.before} after={entry.after} />
          </li>
        ))}
      </ul>
    </article>
  );
}

interface FieldDiffProps {
  field: DiffField;
  before: Rule;
  after: Rule;
}

function FieldDiff({ field, before, after }: FieldDiffProps): JSX.Element {
  const beforeText = formatField(field, before);
  const afterText = formatField(field, after);
  return (
    <div>
      <code>{field}</code>:{' '}
      <span aria-label={`before ${field}`}>
        <del>{beforeText}</del>
      </span>{' '}
      →{' '}
      <span aria-label={`after ${field}`}>
        <ins>{afterText}</ins>
      </span>
    </div>
  );
}

function formatField(field: DiffField, rule: Rule): string {
  switch (field) {
    case 'severity':
      return rule.severity;
    case 'category':
      return rule.category;
    case 'title':
      return rule.title;
    case 'explanation':
      return rule.explanation;
    case 'citation':
      return rule.citation ?? '(none)';
    case 'match':
      // Keep the matcher representation compact; the full body is available
      // to anyone inspecting the pack file. This panel is just a summary.
      return `${rule.match.type}`;
  }
}

export type { PackDiffPanelProps };
