import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CustomRuleBuilderPanel } from './CustomRuleBuilderPanel';
import { parseLease } from '../parser/parseLease';
import { makePdf } from '../parser/testFixtures';
import { detectSections } from '../parser/sections';
import type { LeaseDocument, Paragraph } from '../parser/types';

function docFromParagraphs(paragraphs: Paragraph[]): LeaseDocument {
  return {
    pages: [],
    paragraphs,
    sections: detectSections(paragraphs),
    raw: paragraphs.map((p) => p.text).join('\n\n'),
  };
}

describe('CustomRuleBuilderPanel', () => {
  it('renders all three matcher types in the selector', () => {
    render(
      <CustomRuleBuilderPanel
        doc={null}
        existingRuleIds={[]}
        onSave={() => {}}
      />,
    );
    const select = screen.getByLabelText(/matcher type/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(['regex', 'keywordProximity', 'sectionAnchored']);
  });

  it('swaps to keywordProximity fields when the matcher type changes', async () => {
    render(
      <CustomRuleBuilderPanel
        doc={null}
        existingRuleIds={[]}
        onSave={() => {}}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/matcher type/i),
      'keywordProximity',
    );
    expect(screen.getByLabelText(/keywords/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/window \(characters\)/i)).toBeInTheDocument();
  });

  it('exposes section-anchored sub-fields including the child-matcher selector', async () => {
    render(
      <CustomRuleBuilderPanel
        doc={null}
        existingRuleIds={[]}
        onSave={() => {}}
      />,
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/matcher type/i),
      'sectionAnchored',
    );
    expect(screen.getByLabelText(/heading pattern/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/child matcher type/i)).toBeInTheDocument();
  });

  it('live-preview counts are correct against a parsed PDF fixture', async () => {
    // Synthesize a tiny lease PDF that mentions "automatically renew" twice
    // in two distinct paragraphs, so a global-regex matcher should fire in
    // both places.
    const bytes = await makePdf([
      {
        blocks: [
          { text: '1. Term', x: 72, y: 72, size: 14 },
          {
            text: 'This lease shall automatically renew for one year.',
            x: 72,
            y: 110,
          },
          { text: '2. Notice', x: 72, y: 170, size: 14 },
          {
            text: 'Absent notice the term will automatically renew as stated.',
            x: 72,
            y: 200,
          },
        ],
      },
    ]);
    const doc = await parseLease(bytes);

    render(
      <CustomRuleBuilderPanel
        doc={doc}
        existingRuleIds={[]}
        onSave={() => {}}
      />,
    );

    await userEvent.type(screen.getByLabelText(/rule id/i), 'auto-renew');
    await userEvent.type(
      screen.getByLabelText(/title/i),
      'Auto-renew clause',
    );
    await userEvent.type(
      screen.getByLabelText(/explanation/i),
      'Flags auto-renewal phrasing for review.',
    );
    await userEvent.type(
      screen.getByLabelText(/regex pattern/i),
      'automatically renew',
    );

    const preview = await screen.findByTestId('crb-preview');
    expect(preview.textContent).toMatch(/Fires at 2 locations/);
  });

  it('shows a miss state when the matcher does not fire', async () => {
    const doc = docFromParagraphs([
      { text: 'Tenant shall pay rent on the first.', page: 1 },
    ]);
    render(
      <CustomRuleBuilderPanel
        doc={doc}
        existingRuleIds={[]}
        onSave={() => {}}
      />,
    );
    await userEvent.type(screen.getByLabelText(/rule id/i), 'nope');
    await userEvent.type(screen.getByLabelText(/title/i), 'Nope');
    await userEvent.type(
      screen.getByLabelText(/explanation/i),
      'Will never fire here.',
    );
    await userEvent.type(
      screen.getByLabelText(/regex pattern/i),
      'xyznotpresent',
    );
    const preview = await screen.findByTestId('crb-preview');
    expect(preview.textContent).toMatch(/Does not fire/);
  });

  it('shows a regex compile error inline and suppresses the live preview', async () => {
    const doc = docFromParagraphs([
      { text: 'Anything at all.', page: 1 },
    ]);
    render(
      <CustomRuleBuilderPanel
        doc={doc}
        existingRuleIds={[]}
        onSave={() => {}}
      />,
    );
    await userEvent.type(screen.getByLabelText(/rule id/i), 'bad');
    await userEvent.type(screen.getByLabelText(/title/i), 'Bad');
    await userEvent.type(
      screen.getByLabelText(/explanation/i),
      'Broken regex should suppress preview.',
    );
    // Unbalanced paren is a classic regex compile failure.
    await userEvent.type(
      screen.getByLabelText(/regex pattern/i),
      '(unclosed',
    );
    expect(
      screen.getByText(/regex compile error/i),
    ).toBeInTheDocument();
    // Wave 45-BE — regex error paragraph paired with "Invalid" badge.
    expect(screen.getAllByText(/^Invalid$/i).length).toBeGreaterThan(0);
    const preview = screen.getByTestId('crb-preview');
    expect(preview.textContent).toMatch(/Preview unavailable/);
  });

  it('blocks save when the draft uses an existing rule id', async () => {
    render(
      <CustomRuleBuilderPanel
        doc={null}
        existingRuleIds={['auto-renewal']}
        onSave={() => {}}
      />,
    );
    await userEvent.type(screen.getByLabelText(/rule id/i), 'auto-renewal');
    await userEvent.type(screen.getByLabelText(/title/i), 'Copy of');
    await userEvent.type(
      screen.getByLabelText(/explanation/i),
      'This should be blocked by the duplicate-id guard.',
    );
    await userEvent.type(
      screen.getByLabelText(/regex pattern/i),
      'auto',
    );
    expect(
      screen.getByText(/already exists/i),
    ).toBeInTheDocument();
    // Wave 45-BE — duplicate-id error paired with "Invalid" badge.
    expect(screen.getAllByText(/^Invalid$/i).length).toBeGreaterThan(0);
    expect(
      screen.getByRole('button', { name: /save rule/i }),
    ).toBeDisabled();
  });

  it('disables save until the draft validates and calls onSave exactly once with the built rule', async () => {
    const onSave = vi.fn();
    render(
      <CustomRuleBuilderPanel
        doc={null}
        existingRuleIds={[]}
        onSave={onSave}
      />,
    );

    const save = screen.getByRole('button', { name: /save rule/i });
    expect(save).toBeDisabled();

    await userEvent.type(screen.getByLabelText(/rule id/i), 'custom-rule-1');
    await userEvent.type(screen.getByLabelText(/title/i), 'Custom rule');
    await userEvent.type(
      screen.getByLabelText(/explanation/i),
      'Exercises the full save path.',
    );
    await userEvent.type(
      screen.getByLabelText(/regex pattern/i),
      '\\brent\\b',
    );

    expect(save).not.toBeDisabled();
    await userEvent.click(save);

    expect(onSave).toHaveBeenCalledTimes(1);
    const rule = onSave.mock.calls[0]?.[0];
    expect(rule).toMatchObject({
      id: 'custom-rule-1',
      title: 'Custom rule',
      severity: 'medium',
      category: 'general',
      match: { type: 'regex', pattern: '\\brent\\b' },
    });
  });

  it('surfaces keywordProximity validation errors (e.g. fewer than 2 keywords)', async () => {
    render(
      <CustomRuleBuilderPanel
        doc={null}
        existingRuleIds={[]}
        onSave={() => {}}
      />,
    );
    await userEvent.type(screen.getByLabelText(/rule id/i), 'kw-rule');
    await userEvent.type(screen.getByLabelText(/title/i), 'Keyword rule');
    await userEvent.type(
      screen.getByLabelText(/explanation/i),
      'Not enough keywords yet.',
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/matcher type/i),
      'keywordProximity',
    );
    await userEvent.type(screen.getByLabelText(/keywords/i), 'only-one');
    // Save must be disabled because the schema requires >= 2 keywords.
    expect(
      screen.getByRole('button', { name: /save rule/i }),
    ).toBeDisabled();
    // Wave 45-BE — validation-errors list paired with single
    // "Validation errors" badge (badge applies to the parent <ul>, not
    // each <li>).
    expect(screen.getByText(/^validation errors$/i)).toBeInTheDocument();
  });
});
