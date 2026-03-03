'use client';

import { useEffect, useState } from 'react';
import type { Balance, SpotPrice, TokenMetadata } from '@/lib/market-data/types';

const DEFAULT_CHAIN = 'hyperliquid';
const DEFAULT_SYMBOLS = ['ETH', 'BTC', 'USDC', 'SOL'];

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

function buildQueryString(params: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value.length > 0) {
      searchParams.set(key, value);
    }
  }

  const serialized = searchParams.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
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
  const [marketData, setMarketData] = useState<WorkspaceMarketDataState>(INITIAL_MARKET_DATA_STATE);

  useEffect(() => {
    const abortController = new AbortController();
    let isActive = true;

    async function loadMarketData(): Promise<void> {
      setMarketData((current) => ({ ...current, loading: true, error: null }));
      try {
        const chainQuery = buildQueryString({ chain: DEFAULT_CHAIN });
        const pricesQuery = buildQueryString({
          chain: DEFAULT_CHAIN,
          symbols: DEFAULT_SYMBOLS.join(','),
        });

        const [tokens, prices, balances] = await Promise.all([
          fetch(`/api/mock/tokens${chainQuery}`, { signal: abortController.signal }).then((response) =>
            decodeJSON<TokenMetadata[]>(response),
          ),
          fetch(`/api/mock/prices${pricesQuery}`, { signal: abortController.signal }).then((response) =>
            decodeJSON<Record<string, SpotPrice>>(response),
          ),
          fetch(`/api/mock/balances${chainQuery}`, { signal: abortController.signal }).then((response) =>
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
