import { useCallback, useMemo } from 'react';
import type { Rule } from '../rules/types';
import type { CounterOffer } from '../negotiation/counterOffers';
import type { LeaseDocument } from '../parser/types';

interface UseDerivedAppStateInputs {
  activeRules: Rule[];
  counterOffers: CounterOffer[];
  /**
   * The currently-loaded document, or null when no lease is analyzed.
   * `sectionForParagraph` returns undefined for any paragraph index when
   * this is null — matches App's pre-extraction behavior of returning
   * undefined when `status.kind !== 'analyzed'`.
   */
  doc: LeaseDocument | null;
}

interface UseDerivedAppStateOutputs {
  plainEnglishByRuleId: Record<string, string>;
  suggestedEditByRuleId: Record<string, string>;
  /**
   * Suggested-text resolver: pack rule's `suggestedEdit` is the base,
   * overridden by the user's most-recent counter-offer per rule.
   */
  suggestedTextByRuleId: Record<string, string>;
  /**
   * Map a paragraph index to its section label (number → heading
   * fallback). Used for side-letter clause headings; returns undefined
   * when no doc is loaded or the paragraph isn't in any section.
   */
  sectionForParagraph: (paragraphIndex: number) => string | undefined;
}

export function useDerivedAppState({
  activeRules,
  counterOffers,
  doc,
}: UseDerivedAppStateInputs): UseDerivedAppStateOutputs {
  const plainEnglishByRuleId = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const r of activeRules) if (r.plainEnglish) out[r.id] = r.plainEnglish;
    return out;
  }, [activeRules]);

  const suggestedEditByRuleId = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const r of activeRules) if (r.suggestedEdit) out[r.id] = r.suggestedEdit;
    return out;
  }, [activeRules]);

  const suggestedTextByRuleId = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = { ...suggestedEditByRuleId };
    const latestByRule = new Map<string, CounterOffer>();
    for (const co of counterOffers) {
      const cur = latestByRule.get(co.ruleId);
      if (!cur || co.updatedAt > cur.updatedAt) latestByRule.set(co.ruleId, co);
    }
    for (const [ruleId, co] of latestByRule) out[ruleId] = co.text;
    return out;
  }, [suggestedEditByRuleId, counterOffers]);

  const sectionForParagraph = useCallback(
    (paragraphIndex: number): string | undefined => {
      if (!doc) return undefined;
      const paragraph = doc.paragraphs[paragraphIndex];
      if (!paragraph) return undefined;
      for (const section of doc.sections) {
        if (section.paragraphs.includes(paragraph)) {
          return section.number ?? section.heading;
        }
      }
      return undefined;
    },
    [doc],
  );

  return {
    plainEnglishByRuleId,
    suggestedEditByRuleId,
    suggestedTextByRuleId,
    sectionForParagraph,
  };
}
