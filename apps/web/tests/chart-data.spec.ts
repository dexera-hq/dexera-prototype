import { describe, expect, it } from 'vitest';
import { generateMockPriceCandles } from '../lib/chart-data/mock-chart-data';
import { getSeriesUpdateCandles, mergePriceCandles } from '../lib/chart-data/utils';

describe('chart data utilities', () => {
  it('generates stable historical 1m candles for the same active minute', () => {
    const nowMs = Date.UTC(2026, 2, 10, 10, 15, 12);
    const nextNowMs = nowMs + 4_000;

    const first = generateMockPriceCandles({
      instrument: 'BTC-PERP',
      interval: '1m',
      limit: 5,
      endTimeMs: nowMs,
      nowMs,
    });
    const second = generateMockPriceCandles({
      instrument: 'BTC-PERP',
      interval: '1m',
      limit: 5,
      endTimeMs: nextNowMs,
      nowMs: nextNowMs,
    });

    expect(first).toHaveLength(5);
    expect(first.slice(0, -1)).toEqual(second.slice(0, -1));
    expect(first.at(-1)?.openTimeMs).toBe(second.at(-1)?.openTimeMs);
  });

  it('updates the latest mock candle while the current minute is still open', () => {
    const nowMs = Date.UTC(2026, 2, 10, 10, 15, 5);
    const nextNowMs = nowMs + 22_000;

    const first = generateMockPriceCandles({
      instrument: 'BTC-PERP',
      interval: '1m',
      limit: 3,
      endTimeMs: nowMs,
      nowMs,
    });
    const second = generateMockPriceCandles({
      instrument: 'BTC-PERP',
      interval: '1m',
      limit: 3,
      endTimeMs: nextNowMs,
      nowMs: nextNowMs,
    });

    expect(first.at(-1)?.openTimeMs).toBe(second.at(-1)?.openTimeMs);
    expect(first.at(-1)?.close).not.toBe(second.at(-1)?.close);
  });

  it('merges updated and appended candles while preserving the rolling window', () => {
    const currentCandles = generateMockPriceCandles({
      instrument: 'BTC-PERP',
      interval: '1m',
      limit: 4,
      endTimeMs: Date.UTC(2026, 2, 10, 10, 15, 5),
      nowMs: Date.UTC(2026, 2, 10, 10, 15, 5),
    });
    const nextCandles = generateMockPriceCandles({
      instrument: 'BTC-PERP',
      interval: '1m',
      limit: 2,
      endTimeMs: Date.UTC(2026, 2, 10, 10, 16, 8),
      nowMs: Date.UTC(2026, 2, 10, 10, 16, 8),
    });

    const merged = mergePriceCandles(currentCandles, nextCandles, 4);

    expect(merged).toHaveLength(4);
    expect(merged[0]?.openTimeMs).toBe(currentCandles[1]?.openTimeMs);
    expect(merged.at(-1)?.openTimeMs).toBe(nextCandles.at(-1)?.openTimeMs);
    expect(merged.at(-2)?.close).toBe(nextCandles[0]?.close);
  });

  it('only returns candles that can be safely applied through series.update', () => {
    const currentCandles = generateMockPriceCandles({
      instrument: 'BTC-PERP',
      interval: '1m',
      limit: 3,
      endTimeMs: Date.UTC(2026, 2, 10, 10, 16, 8),
      nowMs: Date.UTC(2026, 2, 10, 10, 16, 8),
    });
    const nextCandles = generateMockPriceCandles({
      instrument: 'BTC-PERP',
      interval: '1m',
      limit: 2,
      endTimeMs: Date.UTC(2026, 2, 10, 10, 16, 30),
      nowMs: Date.UTC(2026, 2, 10, 10, 16, 30),
    });

    const updateCandles = getSeriesUpdateCandles(currentCandles, nextCandles);

    expect(updateCandles).toHaveLength(1);
    expect(updateCandles[0]?.openTimeMs).toBe(currentCandles.at(-1)?.openTimeMs);
  });
});
