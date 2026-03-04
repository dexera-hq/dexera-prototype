'use client';

import { useEffect, useState } from 'react';
import type { InstrumentMetadata, MarkPrice, PerpPosition } from '@/lib/market-data/types';

type ErrorPayload = {
  error?: string;
};

export type WorkspaceMarketDataState = {
  instruments: InstrumentMetadata[];
  marks: Record<string, MarkPrice>;
  positions: PerpPosition[];
  loading: boolean;
  error: string | null;
};

const INITIAL_MARKET_DATA_STATE: WorkspaceMarketDataState = {
  instruments: [],
  marks: {},
  positions: [],
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
        const [instruments, marks, positions] = await Promise.all([
          fetch('/api/mock/instruments', { signal: abortController.signal }).then((response) =>
            decodeJSON<InstrumentMetadata[]>(response),
          ),
          fetch('/api/mock/marks', { signal: abortController.signal }).then((response) =>
            decodeJSON<Record<string, MarkPrice>>(response),
          ),
          fetch('/api/mock/positions', { signal: abortController.signal }).then((response) =>
            decodeJSON<PerpPosition[]>(response),
          ),
        ]);

        if (!isActive) {
          return;
        }

        setMarketData({
          instruments,
          marks,
          positions,
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
