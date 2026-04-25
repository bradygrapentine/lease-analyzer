import { useCallback, useEffect, useState } from 'react';
import {
  deleteCounterOffer,
  listCounterOffers,
  saveCounterOffer,
  type CounterOffer,
} from '../negotiation/counterOffers';

export interface UseCounterOffersApi {
  counterOffers: CounterOffer[];
  refresh: () => Promise<void>;
  save: (ruleId: string, name: string, text: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * Owns the counter-offer list state. Counter-offers are pure persistence —
 * no audit, no rule reanalyze, no pipeline coupling.
 */
export function useCounterOffers(): UseCounterOffersApi {
  const [counterOffers, setCounterOffers] = useState<CounterOffer[]>([]);

  const refresh = useCallback(async (): Promise<void> => {
    setCounterOffers(await listCounterOffers());
  }, []);

  const save = useCallback(
    async (ruleId: string, name: string, text: string): Promise<void> => {
      await saveCounterOffer({ ruleId, name, text });
      await refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await deleteCounterOffer(id);
      await refresh();
    },
    [refresh],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { counterOffers, refresh, save, remove };
}
