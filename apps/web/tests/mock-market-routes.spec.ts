import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET as getInstrumentsRoute } from '../app/api/mock/instruments/route';
import { GET as getMarksRoute } from '../app/api/mock/marks/route';
import { GET as getPositionsRoute } from '../app/api/mock/positions/route';
import type { InstrumentMetadata, MarkPrice, PerpPosition } from '../lib/market-data/types';

const ORIGINAL_ENV = {
  MOCK_MARKET_DATA: process.env.MOCK_MARKET_DATA,
  MOCK_MARKET_DATA_JITTER: process.env.MOCK_MARKET_DATA_JITTER,
  DEFAULT_VENUE: process.env.DEFAULT_VENUE,
};

beforeEach(() => {
  process.env.MOCK_MARKET_DATA = 'true';
  process.env.MOCK_MARKET_DATA_JITTER = 'false';
  process.env.DEFAULT_VENUE = 'hyperliquid';
});

afterEach(() => {
  process.env.MOCK_MARKET_DATA = ORIGINAL_ENV.MOCK_MARKET_DATA;
  process.env.MOCK_MARKET_DATA_JITTER = ORIGINAL_ENV.MOCK_MARKET_DATA_JITTER;
  process.env.DEFAULT_VENUE = ORIGINAL_ENV.DEFAULT_VENUE;
});

describe('mock market data routes', () => {
  it('returns mock instruments from /api/mock/instruments', async () => {
    const response = await getInstrumentsRoute(
      new Request('http://localhost/api/mock/instruments?venue=hyperliquid'),
    );
    const payload = (await response.json()) as InstrumentMetadata[];

    expect(response.status).toBe(200);
    expect(payload.length).toBeGreaterThan(0);
    expect(payload[0]).toMatchObject({
      instrument: expect.any(String),
      name: expect.any(String),
      venue: 'hyperliquid',
    });
  });

  it('returns mark price map shape with timestamp from /api/mock/marks', async () => {
    const response = await getMarksRoute(
      new Request(
        'http://localhost/api/mock/marks?instruments=ETH-PERP,BTC-PERP&venue=hyperliquid',
      ),
    );
    const payload = (await response.json()) as Record<string, MarkPrice>;

    expect(response.status).toBe(200);
    expect(payload['ETH-PERP']).toMatchObject({
      instrument: 'ETH-PERP',
      price: expect.any(Number),
    });
    expect(payload['BTC-PERP']).toMatchObject({
      instrument: 'BTC-PERP',
      price: expect.any(Number),
    });
    expect(payload['ETH-PERP']?.timestampMs).toBeGreaterThan(0);
    expect(payload['BTC-PERP']?.timestampMs).toBeGreaterThan(0);
  });

  it('omits unknown instruments from /api/mock/marks', async () => {
    const response = await getMarksRoute(
      new Request(
        'http://localhost/api/mock/marks?instruments=ETH-PERP,UNKNOWN-PERP&venue=hyperliquid',
      ),
    );
    const payload = (await response.json()) as Record<string, MarkPrice>;

    expect(response.status).toBe(200);
    expect(payload['ETH-PERP']).toBeDefined();
    expect(payload['UNKNOWN-PERP']).toBeUndefined();
  });

  it('returns venue-scoped instruments when /api/mock/marks is called without instrument list', async () => {
    const instrumentsResponse = await getInstrumentsRoute(
      new Request('http://localhost/api/mock/instruments?venue=hyperliquid'),
    );
    const instrumentsPayload = (await instrumentsResponse.json()) as InstrumentMetadata[];
    const expectedInstruments = instrumentsPayload
      .map((item) => item.instrument.toUpperCase())
      .sort();

    const response = await getMarksRoute(
      new Request('http://localhost/api/mock/marks?venue=hyperliquid'),
    );
    const payload = (await response.json()) as Record<string, MarkPrice>;
    const returnedInstruments = Object.keys(payload).sort();

    expect(response.status).toBe(200);
    expect(returnedInstruments).toEqual(expectedInstruments);
  });

  it('returns an empty mark map when venue is unsupported', async () => {
    const response = await getMarksRoute(
      new Request(
        'http://localhost/api/mock/marks?instruments=ETH-PERP,BTC-PERP&venue=unsupported-venue',
      ),
    );
    const payload = (await response.json()) as Record<string, MarkPrice>;

    expect(response.status).toBe(200);
    expect(payload).toEqual({});
  });

  it('returns deterministic positions from /api/mock/positions', async () => {
    const response = await getPositionsRoute(
      new Request('http://localhost/api/mock/positions?venue=hyperliquid&accountId=acct_001'),
    );
    const payload = (await response.json()) as PerpPosition[];

    expect(response.status).toBe(200);
    expect(payload.length).toBeGreaterThan(0);
    expect(payload[0]).toMatchObject({
      instrument: expect.any(String),
      direction: expect.stringMatching(/long|short/),
      size: expect.any(String),
    });
  });
});
