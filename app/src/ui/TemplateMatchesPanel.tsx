import type { ClauseTemplateMatch } from '../templates/types';

interface TemplateMatchesPanelProps {
  matches: ClauseTemplateMatch[];
  matchedThreshold?: number;
  weakThreshold?: number;
}

export type TemplateMatchBadge = 'matched' | 'weak' | 'missing';

export function classifyMatch(
  score: number,
  matchedThreshold: number,
  weakThreshold: number,
): TemplateMatchBadge {
  if (score >= matchedThreshold) return 'matched';
  if (score >= weakThreshold) return 'weak';
  return 'missing';
}

export function TemplateMatchesPanel({
  matches,
  matchedThreshold = 0.7,
  weakThreshold = 0.4,
}: TemplateMatchesPanelProps): JSX.Element {
  if (matches.length === 0) {
    return (
      <section aria-label="template matches">
        <h2>Template matches</h2>
        <p>No clause templates to compare against.</p>
      </section>
    );
  }
  return (
    <section aria-label="template matches">
      <h2>Template matches</h2>
      <ul>
        {matches.map((m) => {
          const badge = classifyMatch(m.bestScore, matchedThreshold, weakThreshold);
          return (
            <li key={m.templateId}>
              <strong>{m.templateName}</strong>{' '}
              <span aria-label={`template status ${badge}`} data-badge={badge}>
                {badge}
              </span>{' '}
              <small>score {m.bestScore.toFixed(2)}</small>
              {m.matchedSnippet && m.matchedPage !== null && (
                <>
                  <blockquote>{m.matchedSnippet}</blockquote>
                  <small>Page {m.matchedPage}</small>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
