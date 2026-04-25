import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type ReviewMode =
  | { active: true; archiveId: string; expiresAt: string }
  | { active: false };

interface ReviewModeApi {
  mode: ReviewMode;
  enter: (args: { archiveId: string; expiresAt: string }) => void;
  exit: () => void;
}

const INACTIVE: ReviewMode = { active: false };

const ReviewModeContext = createContext<ReviewModeApi | null>(null);

export function ReviewModeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [mode, setMode] = useState<ReviewMode>(INACTIVE);

  const enter = useCallback((args: { archiveId: string; expiresAt: string }) => {
    setMode({ active: true, archiveId: args.archiveId, expiresAt: args.expiresAt });
  }, []);

  const exit = useCallback(() => {
    setMode(INACTIVE);
  }, []);

  const value = useMemo<ReviewModeApi>(() => ({ mode, enter, exit }), [mode, enter, exit]);

  return createElement(ReviewModeContext.Provider, { value }, children);
}

export function useReviewMode(): ReviewModeApi {
  const ctx = useContext(ReviewModeContext);
  if (ctx) return ctx;
  // Tolerate use outside the provider so downstream panels can defensively
  // read `mode.active === false` without forcing every host to wrap them.
  return { mode: INACTIVE, enter: () => {}, exit: () => {} };
}
