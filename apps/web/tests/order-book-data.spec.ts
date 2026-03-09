import { describe, expect, it } from 'vitest';

import {
  createPlaceholderOrderBook,
  evolvePlaceholderOrderBook,
} from '../components/workspace/order-book-data';

describe('placeholder order book data', () => {
  it('creates a consistent bid and ask ladder around the reference price', () => {
    const snapshot = createPlaceholderOrderBook({
      instrument: 'ETH-PERP',
      midPrice: 3200,
      timestampMs: 1_700_000_000_000,
    });

    expect(snapshot.asks).toHaveLength(9);
    expect(snapshot.bids).toHaveLength(9);
    expect(snapshot.asks[0]!.price).toBeGreaterThan(snapshot.midPrice);
    expect(snapshot.bids[0]!.price).toBeLessThan(snapshot.midPrice);

    snapshot.asks.forEach((level, index, levels) => {
      if (index > 0) {
        expect(level.price).toBeGreaterThan(levels[index - 1]!.price);
        expect(level.total).toBeGreaterThan(levels[index - 1]!.total);
      }
    });

    snapshot.bids.forEach((level, index, levels) => {
      if (index > 0) {
        expect(level.price).toBeLessThan(levels[index - 1]!.price);
        expect(level.total).toBeGreaterThan(levels[index - 1]!.total);
      }
    });

    const askSpawned = snapshot.asks.some((level) => level.spawnedSize > 0);
    const bidSpawned = snapshot.bids.some((level) => level.spawnedSize > 0);

    expect(askSpawned || bidSpawned).toBe(true);
    expect(askSpawned && bidSpawned).toBe(false);
  });

  it('evolves the book and alternates the spawning side over time', () => {
    const initial = createPlaceholderOrderBook({
      instrument: 'BTC-PERP',
      midPrice: 97_400,
      timestampMs: 1_700_000_000_000,
    });
    const next = evolvePlaceholderOrderBook(initial, 1_700_000_000_900);
    const later = evolvePlaceholderOrderBook(next, 1_700_000_001_800);

    expect(next.step).toBe(initial.step + 1);
    expect(next.updatedAt).toBe(1_700_000_000_900);
    expect(next.spawnedOrder.restingSide).not.toBe(initial.spawnedOrder.restingSide);
    expect(later.spawnedOrder.restingSide).toBe(initial.spawnedOrder.restingSide);
    expect(next.spread).toBeGreaterThan(0);
  });
});
