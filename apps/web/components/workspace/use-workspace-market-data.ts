'use client';

import { useEffect, useState } from 'react';
import type { Balance, SpotPrice, TokenMetadata } from '@/lib/market-data/types';

type ErrorPayload = {
  error?: string;
};

export type WorkspaceMarketDataState = {
  tokens: TokenMetadata[];
  prices: Record<string, SpotPrice>;
  balances: Balance[];
  loading: boolean;
  error: string | null;
};

const INITIAL_MARKET_DATA_STATE: WorkspaceMarketDataState = {
  tokens: [],
  prices: {},
  balances: [],
  loading: true,
  error: null,
};

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
  const [marketData, setMarketData] = useState<WorkspaceMarketDataState>(INITIAL_MARKET_DATA_STATE);

  useEffect(() => {
    const abortController = new AbortController();
    let isActive = true;

    async function loadMarketData(): Promise<void> {
      setMarketData((current) => ({ ...current, loading: true, error: null }));
      try {
        const [tokens, prices, balances] = await Promise.all([
          fetch('/api/mock/tokens', { signal: abortController.signal }).then((response) =>
            decodeJSON<TokenMetadata[]>(response),
          ),
          fetch('/api/mock/prices', { signal: abortController.signal }).then((response) =>
            decodeJSON<Record<string, SpotPrice>>(response),
          ),
          fetch('/api/mock/balances', { signal: abortController.signal }).then((response) =>
            decodeJSON<Balance[]>(response),
          ),
        ]);

        if (!isActive) {
          return;
        }

        setMarketData({
          tokens,
          prices,
          balances,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!isActive || abortController.signal.aborted) {
          return;
        }

        setMarketData((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to load market data',
        }));
      }
    }

    void loadMarketData();

    return () => {
      isActive = false;
      abortController.abort();
    };
  }, []);

  return marketData;
}
