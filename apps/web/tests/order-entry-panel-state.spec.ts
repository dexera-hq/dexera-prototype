import { describe, expect, it } from 'vitest';

import {
  collectOrderEntryInstruments,
  resolveLimitPriceAutofill,
} from '../lib/wallet/order-entry-panel-state';

describe('order entry panel state helpers', () => {
  it('collects all loaded instruments without venue filtering', () => {
    const instruments = collectOrderEntryInstruments([
      {
        instrument: 'btc-perp',
        name: 'Bitcoin Perpetual',
        venue: 'hyperliquid',
      },
      {
        instrument: 'ETH-PERP',
        name: 'Ether Perpetual',
        venue: 'aster',
      },
      {
        instrument: 'btc-perp',
        name: 'Bitcoin Perpetual Duplicate',
        venue: 'aster',
      },
    ]);

    expect(instruments).toEqual(['BTC-PERP', 'ETH-PERP']);
  });

  it('autofills from mark price when limit price is missing', () => {
    const result = resolveLimitPriceAutofill({
      orderType: 'limit',
      instrument: 'BTC-PERP',
      currentLimitPrice: '',
      markPrice: 68450.257,
      lastSyncedInstrument: 'BTC-PERP',
    });

    expect(result).toEqual({
      nextLimitPrice: '68450.26',
      nextSyncedInstrument: 'BTC-PERP',
    });
  });

  it('recomputes limit price when the instrument changes in limit mode', () => {
    const result = resolveLimitPriceAutofill({
      orderType: 'limit',
      instrument: 'ETH-PERP',
      currentLimitPrice: '68450.26',
      markPrice: 3200.5,
      lastSyncedInstrument: 'BTC-PERP',
    });

    expect(result).toEqual({
      nextLimitPrice: '3200.50',
      nextSyncedInstrument: 'ETH-PERP',
    });
  });

  it('does not autofill for market orders or unchanged instrument with a value', () => {
    const marketOrder = resolveLimitPriceAutofill({
      orderType: 'market',
      instrument: 'ETH-PERP',
      currentLimitPrice: '3200.50',
      markPrice: 3200.5,
      lastSyncedInstrument: 'BTC-PERP',
    });
    expect(marketOrder).toBeNull();

    const unchangedInstrument = resolveLimitPriceAutofill({
      orderType: 'limit',
      instrument: 'ETH-PERP',
      currentLimitPrice: '3200.50',
      markPrice: 3200.5,
      lastSyncedInstrument: 'ETH-PERP',
    });
    expect(unchangedInstrument).toBeNull();
  });
});
