import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET as getBalancesRoute } from '../app/api/mock/balances/route';
import { GET as getPricesRoute } from '../app/api/mock/prices/route';
import { GET as getTokensRoute } from '../app/api/mock/tokens/route';
import type { Balance, SpotPrice, TokenMetadata } from '../lib/market-data/types';

const ORIGINAL_ENV = {
  MOCK_MARKET_DATA: process.env.MOCK_MARKET_DATA,
  MOCK_MARKET_DATA_JITTER: process.env.MOCK_MARKET_DATA_JITTER,
  DEFAULT_CHAIN: process.env.DEFAULT_CHAIN,
};

beforeEach(() => {
  process.env.MOCK_MARKET_DATA = 'true';
  process.env.MOCK_MARKET_DATA_JITTER = 'false';
  process.env.DEFAULT_CHAIN = 'hyperliquid';
});

afterEach(() => {
  process.env.MOCK_MARKET_DATA = ORIGINAL_ENV.MOCK_MARKET_DATA;
  process.env.MOCK_MARKET_DATA_JITTER = ORIGINAL_ENV.MOCK_MARKET_DATA_JITTER;
  process.env.DEFAULT_CHAIN = ORIGINAL_ENV.DEFAULT_CHAIN;
});

describe('mock market data routes', () => {
  it('returns mock tokens from /api/mock/tokens', async () => {
    const response = await getTokensRoute(new Request('http://localhost/api/mock/tokens?chain=hyperliquid'));
    const payload = (await response.json()) as TokenMetadata[];

    expect(response.status).toBe(200);
    expect(payload.length).toBeGreaterThan(0);
    expect(payload[0]).toMatchObject({
      symbol: expect.any(String),
      name: expect.any(String),
      decimals: expect.any(Number),
      chain: 'hyperliquid',
    });
  });

  it('returns spot price map shape with timestamp from /api/mock/prices', async () => {
    const response = await getPricesRoute(
      new Request('http://localhost/api/mock/prices?symbols=ETH,BTC&chain=hyperliquid'),
    );
    const payload = (await response.json()) as Record<string, SpotPrice>;

    expect(response.status).toBe(200);
    expect(payload.ETH).toMatchObject({ symbol: 'ETH', price: expect.any(Number) });
    expect(payload.BTC).toMatchObject({ symbol: 'BTC', price: expect.any(Number) });
    if (!payload.ETH || !payload.BTC) {
      throw new Error('Missing expected symbols in /api/mock/prices response');
    }
    expect(payload.ETH.timestampMs).toBeGreaterThan(0);
    expect(payload.BTC.timestampMs).toBeGreaterThan(0);
  });

  it('omits unknown symbols from /api/mock/prices', async () => {
    const response = await getPricesRoute(
      new Request('http://localhost/api/mock/prices?symbols=ETH,UNKNOWN&chain=hyperliquid'),
    );
    const payload = (await response.json()) as Record<string, SpotPrice>;

    expect(response.status).toBe(200);
    expect(payload.ETH).toBeDefined();
    expect(payload.UNKNOWN).toBeUndefined();
  });

  it('returns deterministic balances from /api/mock/balances', async () => {
    const response = await getBalancesRoute(new Request('http://localhost/api/mock/balances?chain=hyperliquid'));
    const payload = (await response.json()) as Balance[];

    expect(response.status).toBe(200);
    expect(payload.length).toBeGreaterThan(0);
    expect(payload[0]).toMatchObject({
      symbol: expect.any(String),
      balance: expect.any(String),
    });
  });
});
