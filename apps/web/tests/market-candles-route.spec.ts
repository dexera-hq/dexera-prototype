import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getCandlesRoute } from '../app/api/market/candles/route';
import type { PriceCandle } from '../lib/market-data/types';

const ORIGINAL_ENV = {
  CHART_MARKET_DATA_SOURCE: process.env.CHART_MARKET_DATA_SOURCE,
  HYPERLIQUID_API_BASE_URL: process.env.HYPERLIQUID_API_BASE_URL,
  HYPERLIQUID_NETWORK: process.env.HYPERLIQUID_NETWORK,
};

beforeEach(() => {
  process.env.CHART_MARKET_DATA_SOURCE = 'mock';
  process.env.HYPERLIQUID_API_BASE_URL = 'https://api.hyperliquid.xyz';
  process.env.HYPERLIQUID_NETWORK = 'mainnet';
});

afterEach(() => {
  process.env.CHART_MARKET_DATA_SOURCE = ORIGINAL_ENV.CHART_MARKET_DATA_SOURCE;
  process.env.HYPERLIQUID_API_BASE_URL = ORIGINAL_ENV.HYPERLIQUID_API_BASE_URL;
  process.env.HYPERLIQUID_NETWORK = ORIGINAL_ENV.HYPERLIQUID_NETWORK;
  vi.restoreAllMocks();
});

describe('market candles route', () => {
  it('returns mock candles with the requested limit', async () => {
    const response = await getCandlesRoute(
      new Request(
        'http://localhost/api/market/candles?instrument=BTC-PERP&interval=1m&limit=3&venue=hyperliquid',
      ),
    );
    const payload = (await response.json()) as PriceCandle[];

    expect(response.status).toBe(200);
    expect(payload).toHaveLength(3);
    expect(payload[0]).toMatchObject({
      instrument: 'BTC-PERP',
      interval: '1m',
      open: expect.any(Number),
      high: expect.any(Number),
      low: expect.any(Number),
      close: expect.any(Number),
      volume: expect.any(Number),
    });
  });

  it('rejects requests without an instrument', async () => {
    const response = await getCandlesRoute(
      new Request('http://localhost/api/market/candles?interval=1m&limit=3'),
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain('instrument is required');
  });

  it('rejects unsupported intervals', async () => {
    const response = await getCandlesRoute(
      new Request(
        'http://localhost/api/market/candles?instrument=BTC-PERP&interval=5m&limit=3&venue=hyperliquid',
      ),
    );
    const payload = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(payload.error).toContain('Unsupported interval');
  });

  it('maps Hyperliquid candle snapshots into app candles', async () => {
    process.env.CHART_MARKET_DATA_SOURCE = 'hyperliquid';

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            t: 1_710_000_000_000,
            T: 1_710_000_060_000,
            i: '1m',
            n: 12,
            o: '68410.10',
            h: '68488.20',
            l: '68395.00',
            c: '68456.80',
            s: 'BTC',
            v: '123.4567',
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    vi.stubGlobal('fetch', fetchMock);

    const response = await getCandlesRoute(
      new Request(
        'http://localhost/api/market/candles?instrument=BTC-PERP&interval=1m&limit=1&venue=hyperliquid&endTimeMs=1710000060000',
      ),
    );
    const payload = (await response.json()) as PriceCandle[];

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.hyperliquid.xyz/info');
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      cache: 'no-store',
    });
    expect(payload).toEqual([
      {
        instrument: 'BTC-PERP',
        interval: '1m',
        openTimeMs: 1_710_000_000_000,
        closeTimeMs: 1_710_000_060_000,
        open: 68410.1,
        high: 68488.2,
        low: 68395,
        close: 68456.8,
        volume: 123.4567,
      },
    ]);
  });
});
