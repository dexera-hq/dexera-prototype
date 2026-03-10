'use client';

import { useEffect, useMemo, useState } from 'react';
import type { BffPerpPositionsResponse } from '@dexera/api-types/openapi';
import type { InstrumentMetadata, MarkPrice, PerpPosition } from '@/lib/market-data/types';
import { getPerpPositions } from '@/lib/market-data/get-perp-positions';
import {
  aggregateWalletPositions,
  collectConnectedPositionWallets,
} from '@/lib/market-data/positions-engine';
import { getWalletVenueLabel } from '@/lib/wallet/chains';
import { useWalletManager } from '@/lib/wallet/wallet-manager-context';

type ErrorPayload = {
  error?: string;
};

export type WorkspaceMarketDataState = {
  instruments: InstrumentMetadata[];
  marks: Record<string, MarkPrice>;
  positions: PerpPosition[];
  connectedWalletCount: number;
  loading: boolean;
  error: string | null;
};

const INITIAL_MARKET_DATA_STATE: WorkspaceMarketDataState = {
  instruments: [],
  marks: {},
  positions: [],
  connectedWalletCount: 0,
  loading: true,
  error: null,
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function truncateAccountId(accountId: string): string {
  if (accountId.length <= 14) {
    return accountId;
  }

  return `${accountId.slice(0, 8)}...${accountId.slice(-4)}`;
}

function combineErrors(...errors: Array<string | null>): string | null {
  const messages = errors.filter((error): error is string => Boolean(error));
  if (messages.length === 0) {
    return null;
  }

  return messages.join(' ');
}

async function decodeJSON<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  let message = `Market data request failed (${response.status})`;
  try {
    const payload = (await response.json()) as ErrorPayload;
    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      message = payload.error;
    }
  } catch {
    // Ignore JSON parse failures and keep the default message.
  }

  throw new Error(message);
}

export function useWorkspaceMarketData(): WorkspaceMarketDataState {
  const { hasHydrated, slots } = useWalletManager();
  const [instruments, setInstruments] = useState<InstrumentMetadata[]>(
    INITIAL_MARKET_DATA_STATE.instruments,
  );
  const [marks, setMarks] = useState<Record<string, MarkPrice>>(INITIAL_MARKET_DATA_STATE.marks);
  const [positions, setPositions] = useState<PerpPosition[]>(INITIAL_MARKET_DATA_STATE.positions);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const connectedWallets = useMemo(() => collectConnectedPositionWallets(slots), [slots]);

  useEffect(() => {
    const abortController = new AbortController();
    let isActive = true;

    async function loadReferenceMarketData(): Promise<void> {
      setReferenceLoading(true);
      setReferenceError(null);

      try {
        const [nextInstruments, nextMarks] = await Promise.all([
          fetch('/api/mock/instruments', { signal: abortController.signal }).then((response) =>
            decodeJSON<InstrumentMetadata[]>(response),
          ),
          fetch('/api/mock/marks', { signal: abortController.signal }).then((response) =>
            decodeJSON<Record<string, MarkPrice>>(response),
          ),
        ]);

        if (!isActive) {
          return;
        }

        setInstruments(nextInstruments);
        setMarks(nextMarks);
        setReferenceLoading(false);
      } catch (error) {
        if (!isActive || abortController.signal.aborted) {
          return;
        }

        setReferenceError(getErrorMessage(error, 'Unable to load market data'));
        setReferenceLoading(false);
      }
    }

    void loadReferenceMarketData();

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    let isActive = true;

    async function loadWalletPositions(): Promise<void> {
      if (connectedWallets.length === 0) {
        if (!isActive) {
          return;
        }

        setPositions([]);
        setPositionsError(null);
        setPositionsLoading(false);
        return;
      }

      setPositionsLoading(true);
      setPositionsError(null);

      const results = await Promise.allSettled(
        connectedWallets.map((wallet) =>
          getPerpPositions({
            accountId: wallet.accountId,
            venue: wallet.venue,
          }),
        ),
      );

      if (!isActive) {
        return;
      }

      const successfulResponses: BffPerpPositionsResponse[] = [];
      const failedMessages: string[] = [];

      for (const [index, result] of results.entries()) {
        if (result.status === 'fulfilled') {
          successfulResponses.push(result.value);
          continue;
        }

        const wallet = connectedWallets[index];
        if (!wallet) {
          continue;
        }

        const message = getErrorMessage(result.reason, 'Unable to load perp positions.');
        failedMessages.push(
          `${getWalletVenueLabel(wallet.venue)} ${truncateAccountId(wallet.accountId)}: ${message}`,
        );
      }

      setPositions(aggregateWalletPositions(successfulResponses));
      setPositionsLoading(false);
      setPositionsError(
        failedMessages.length > 0
          ? `Some wallet positions could not be loaded. ${failedMessages.join(' ')}`
          : null,
      );
    }

    void loadWalletPositions();

    return () => {
      isActive = false;
    };
  }, [connectedWallets, hasHydrated]);

  return {
    instruments,
    marks,
    positions,
    connectedWalletCount: connectedWallets.length,
    loading: referenceLoading || positionsLoading || !hasHydrated,
    error: combineErrors(referenceError, positionsError),
  };
}
