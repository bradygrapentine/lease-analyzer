// Wave 45-BE — small detail card for the currently-selected finding,
// extracted from AppCurrentPane.tsx to keep the coordinator under
// the ≤120-line budget. Aria landmark `aria-label="selected finding"`
// on the article element is preserved verbatim.

import { Card } from '../system/Card';
import type { Finding } from '../../rules/types';

export interface SelectedFindingCardProps {
  finding: Finding;
}

export function SelectedFindingCard({ finding }: SelectedFindingCardProps): JSX.Element {
  return (
    <Card as="article" aria-label="selected finding" className="p-4 space-y-2 my-3">
      <h3 className="text-heading uppercase text-fg-muted">{finding.title}</h3>
      <p className="text-body text-fg-body">{finding.explanation}</p>
      <blockquote className="border-l border-rule pl-3 font-mono text-mono text-fg-muted italic">
        {finding.snippet}
      </blockquote>
      <span className="text-small text-fg-muted">Page {finding.page}</span>
    </Card>
  );
}
