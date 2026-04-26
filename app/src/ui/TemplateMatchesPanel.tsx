import type { ClauseTemplateMatch } from '../templates/types';
import { classifyMatch } from './templateMatch';
import { Section } from './system/Section';
import { Card } from './system/Card';
import { Badge } from './system/Badge';

// Aria/data inventory (preserved verbatim):
//   aria-label="template matches" (section)
//   aria-label="template status ${badge}" (span)
//   data-badge={badge} (span)

interface TemplateMatchesPanelProps {
  matches: ClauseTemplateMatch[];
  matchedThreshold?: number;
  weakThreshold?: number;
}

export function TemplateMatchesPanel({
  matches,
  matchedThreshold = 0.7,
  weakThreshold = 0.4,
}: TemplateMatchesPanelProps): JSX.Element {
  if (matches.length === 0) {
    return (
      <Section label="template matches">
        <h3 className="text-heading uppercase text-fg-muted mb-3">Template matches</h3>
        <p className="text-body text-fg-faint">No clause templates to compare against.</p>
      </Section>
    );
  }
  return (
    <Section label="template matches" className="space-y-2">
      <h3 className="text-heading uppercase text-fg-muted mb-3">Template matches</h3>
      <ul className="space-y-2">
        {matches.map((m) => {
          const badge = classifyMatch(m.bestScore, matchedThreshold, weakThreshold);
          return (
            <li key={m.templateId}>
              <Card className="p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-body text-fg-body font-sans font-semibold">{m.templateName}</span>
                  <span aria-label={`template status ${badge}`} data-badge={badge}>
                    <Badge variant="outline">{badge}</Badge>
                  </span>
                  <span className="text-mono font-mono text-fg-muted">
                    score {m.bestScore.toFixed(2)}
                  </span>
                </div>
                {m.matchedSnippet && m.matchedPage !== null && (
                  <div>
                    <blockquote className="border-l-2 border-rule pl-3 font-mono text-mono text-fg-muted italic">
                      {m.matchedSnippet}
                    </blockquote>
                    <span className="text-small text-fg-muted">Page {m.matchedPage}</span>
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
