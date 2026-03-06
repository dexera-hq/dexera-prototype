'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  appendSubmittedPerpAction,
  parsePerpActivityStore,
  PERP_ACTIVITY_STORAGE_KEY,
  serializePerpActivityStore,
  type PerpActivityLedger,
  type RecordSubmittedPerpActionInput,
} from '@/lib/wallet/perp-activity';

type PerpActivityContextValue = {
  ledger: PerpActivityLedger;
  recordSubmittedAction: (input: RecordSubmittedPerpActionInput) => void;
};

const fallbackContextValue: PerpActivityContextValue = {
  ledger: {},
  recordSubmittedAction: () => {},
};

const PerpActivityContext = createContext<PerpActivityContextValue>(fallbackContextValue);

export function PerpActivityProvider({ children }: { children: ReactNode }) {
  const [ledger, setLedger] = useState<PerpActivityLedger>({});
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      setLedger(parsePerpActivityStore(window.localStorage.getItem(PERP_ACTIVITY_STORAGE_KEY)));
    } catch {
      setLedger({});
    } finally {
      setHasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydrated || typeof window === 'undefined') {
      return;
    }

    try {
      window.localStorage.setItem(PERP_ACTIVITY_STORAGE_KEY, serializePerpActivityStore(ledger));
    } catch {
      // Ignore local storage write failures in prototype mode.
    }
  }, [hasHydrated, ledger]);

  const recordSubmittedAction = useCallback((input: RecordSubmittedPerpActionInput) => {
    setLedger((currentLedger) => appendSubmittedPerpAction(currentLedger, input));
  }, []);

  const contextValue = useMemo(
    () => ({
      ledger,
      recordSubmittedAction,
    }),
    [ledger, recordSubmittedAction],
  );

  return <PerpActivityContext.Provider value={contextValue}>{children}</PerpActivityContext.Provider>;
}

export function usePerpActivity(): PerpActivityContextValue {
  return useContext(PerpActivityContext);
}
