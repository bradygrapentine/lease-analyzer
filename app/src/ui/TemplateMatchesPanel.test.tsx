import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TemplateMatchesPanel } from './TemplateMatchesPanel';
import { classifyMatch } from './templateMatch';
import type { ClauseTemplateMatch } from '../templates/types';

function match(over: Partial<ClauseTemplateMatch>): ClauseTemplateMatch {
  return {
    templateId: 't',
    templateName: 'A template',
    bestScore: 0.5,
    matchedParagraphIndex: 0,
    matchedPage: 1,
    matchedSnippet: 'matched text',
    ...over,
  };
}

describe('classifyMatch', () => {
  it('classifies scores >= matchedThreshold as matched', () => {
    expect(classifyMatch(0.9, 0.7, 0.4)).toBe('matched');
    expect(classifyMatch(0.7, 0.7, 0.4)).toBe('matched');
  });
  it('classifies scores in [weak, matched) as weak', () => {
    expect(classifyMatch(0.5, 0.7, 0.4)).toBe('weak');
    expect(classifyMatch(0.4, 0.7, 0.4)).toBe('weak');
  });
  it('classifies scores below weak threshold as missing', () => {
    expect(classifyMatch(0.3, 0.7, 0.4)).toBe('missing');
    expect(classifyMatch(0, 0.7, 0.4)).toBe('missing');
  });
});

describe('TemplateMatchesPanel', () => {
  it('renders nothing when there are no matches (distill: hide-empty rail)', () => {
    const { container } = render(<TemplateMatchesPanel matches={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a matched badge and the snippet when score is high', () => {
    render(
      <TemplateMatchesPanel
        matches={[
          match({
            templateId: 'a',
            templateName: 'Arbitration',
            bestScore: 0.95,
            matchedSnippet: 'Any dispute shall be arbitrated.',
            matchedPage: 3,
          }),
        ]}
      />,
    );
    expect(screen.getByText('Arbitration')).toBeInTheDocument();
    expect(screen.getByLabelText(/template status matched/i)).toBeInTheDocument();
    expect(screen.getByText(/any dispute shall be arbitrated/i)).toBeInTheDocument();
    expect(screen.getByText(/page 3/i)).toBeInTheDocument();
  });

  it('renders a weak badge for mid-range scores', () => {
    render(
      <TemplateMatchesPanel
        matches={[match({ templateId: 'w', templateName: 'Weak', bestScore: 0.5 })]}
      />,
    );
    expect(screen.getByLabelText(/template status weak/i)).toBeInTheDocument();
  });

  it('renders a missing badge and no snippet when score is below weak threshold', () => {
    render(
      <TemplateMatchesPanel
        matches={[
          match({
            templateId: 'm',
            templateName: 'Missing',
            bestScore: 0.1,
            matchedSnippet: null,
            matchedPage: null,
            matchedParagraphIndex: null,
          }),
        ]}
      />,
    );
    expect(screen.getByLabelText(/template status missing/i)).toBeInTheDocument();
    expect(screen.queryByRole('blockquote')).not.toBeInTheDocument();
  });

  it('respects custom thresholds', () => {
    render(
      <TemplateMatchesPanel
        matches={[match({ templateId: 'x', templateName: 'X', bestScore: 0.55 })]}
        matchedThreshold={0.5}
        weakThreshold={0.2}
      />,
    );
    expect(screen.getByLabelText(/template status matched/i)).toBeInTheDocument();
  });
});
