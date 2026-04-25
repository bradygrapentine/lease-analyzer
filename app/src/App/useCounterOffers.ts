import { useCallback, useEffect, useState } from 'react';
import {
  deleteCounterOffer as storageDelete,
  listCounterOffers,
  saveCounterOffer,
  type CounterOffer,
} from '../negotiation/counterOffers';

export interface UseCounterOffersApi {
  counterOffers: CounterOffer[];
  /**
   * Map of ruleId → most-recently-saved counter-offer text. Used by the
   * "Apply suggestion" flow in FindingsPanel; falls back to a rule's
   * built-in `suggestedEdit` at the call site.
   */
  latestTextByRuleId: Record<string, string>;
  save: (ruleId: string, name: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Counter-offer library: a flat user-authored list keyed by ruleId.
 * Loaded once on mount; mutations refresh the in-memory list synchronously
 * via `refresh()` so the FindingsPanel "Apply suggestion" map stays current.
 */
export function useCounterOffers(): UseCounterOffersApi {
  const [counterOffers, setCounterOffers] = useState<CounterOffer[]>([]);

  const refresh = useCallback(async (): Promise<void> => {
    setCounterOffers(await listCounterOffers());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (ruleId: string, name: string, text: string): Promise<void> => {
      await saveCounterOffer({ ruleId, name, text });
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await storageDelete(id);
      await refresh();
    },
    [refresh],
  );

  const latestTextByRuleId: Record<string, string> = {};
  const latest = new Map<string, CounterOffer>();
  for (const co of counterOffers) {
    const cur = latest.get(co.ruleId);
    if (!cur || co.updatedAt > cur.updatedAt) latest.set(co.ruleId, co);
  }
  for (const [ruleId, co] of latest) latestTextByRuleId[ruleId] = co.text;

  return { counterOffers, latestTextByRuleId, save, remove, refresh };
}
