import { describe, expect, it } from 'vitest';

import { buildExposureDashboardViewModel } from '../components/workspace/exposure-dashboard-logic';
import type { PerpPosition } from '../lib/market-data/types';

function createPosition(overrides: Partial<PerpPosition> = {}): PerpPosition {
  return {
    positionId: overrides.positionId ?? 'pos-1',
    accountId: overrides.accountId ?? '0xabc',
    venue: overrides.venue ?? 'hyperliquid',
    instrument: overrides.instrument ?? 'ETH-PERP',
    direction: overrides.direction ?? 'long',
    size: overrides.size ?? '1.00',
    entryPrice: overrides.entryPrice ?? '3200.00',
    markPrice: overrides.markPrice ?? '3210.00',
    unrealizedPnlUsd: overrides.unrealizedPnlUsd ?? '10.00',
    notionalValue: overrides.notionalValue ?? '3210.00',
    leverage: overrides.leverage,
    status: overrides.status ?? 'open',
    lastUpdatedAt: overrides.lastUpdatedAt ?? '2026-03-09T12:00:00Z',
  };
}

describe('exposure dashboard logic', () => {
  it('aggregates gross totals across open perp positions', () => {
    const viewModel = buildExposureDashboardViewModel(
      [
        createPosition({
          positionId: 'hl-long',
          accountId: '0xwallet-a',
          venue: 'hyperliquid',
          instrument: 'BTC-PERP',
          direction: 'long',
          notionalValue: '1200.00',
          unrealizedPnlUsd: '25.00',
        }),
        createPosition({
          positionId: 'as-short',
          accountId: '0xwallet-b',
          venue: 'aster',
          instrument: 'ETH-PERP',
          direction: 'short',
          notionalValue: '800.00',
          unrealizedPnlUsd: '-15.00',
        }),
        createPosition({
          positionId: 'closed',
          accountId: '0xwallet-c',
          venue: 'hyperliquid',
          instrument: 'SOL-PERP',
          direction: 'long',
          notionalValue: '999999.00',
          unrealizedPnlUsd: '999999.00',
          status: 'closed',
        }),
      ],
      3,
    );

    expect(viewModel).toMatchObject({
      connectedWalletCount: 3,
      activeWalletCount: 2,
      openPositionCount: 2,
      totalNotionalValue: 2000,
      totalLongNotionalValue: 1200,
      totalShortNotionalValue: 800,
      totalUnrealizedPnlUsd: 10,
    });
  });

  it('rolls exposure into top instruments across multiple wallets', () => {
    const viewModel = buildExposureDashboardViewModel(
      [
        createPosition({
          positionId: 'btc-1',
          accountId: '0xwallet-a',
          venue: 'hyperliquid',
          instrument: 'BTC-PERP',
          direction: 'long',
          notionalValue: '700.00',
          unrealizedPnlUsd: '10.00',
        }),
        createPosition({
          positionId: 'btc-2',
          accountId: '0xwallet-b',
          venue: 'aster',
          instrument: 'BTC-PERP',
          direction: 'short',
          notionalValue: '500.00',
          unrealizedPnlUsd: '-20.00',
        }),
        createPosition({
          positionId: 'eth-1',
          accountId: '0xwallet-a',
          venue: 'hyperliquid',
          instrument: 'ETH-PERP',
          direction: 'long',
          notionalValue: '300.00',
          unrealizedPnlUsd: '5.00',
        }),
      ],
      2,
    );

    expect(viewModel.topInstruments).toEqual([
      expect.objectContaining({
        instrument: 'BTC-PERP',
        totalNotionalValue: 1200,
        totalUnrealizedPnlUsd: -10,
        totalLongNotionalValue: 700,
        totalShortNotionalValue: 500,
        openPositionCount: 2,
        walletCount: 2,
      }),
      expect.objectContaining({
        instrument: 'ETH-PERP',
        totalNotionalValue: 300,
        totalUnrealizedPnlUsd: 5,
        totalLongNotionalValue: 300,
        totalShortNotionalValue: 0,
        openPositionCount: 1,
        walletCount: 1,
      }),
    ]);
  });

  it('ranks venues by gross notional and tracks venue wallet coverage', () => {
    const viewModel = buildExposureDashboardViewModel(
      [
        createPosition({
          positionId: 'hl-1',
          accountId: '0xwallet-a',
          venue: 'hyperliquid',
          instrument: 'BTC-PERP',
          notionalValue: '400.00',
        }),
        createPosition({
          positionId: 'hl-2',
          accountId: '0xwallet-b',
          venue: 'hyperliquid',
          instrument: 'ETH-PERP',
          notionalValue: '600.00',
        }),
        createPosition({
          positionId: 'as-1',
          accountId: '0xwallet-a',
          venue: 'aster',
          instrument: 'SOL-PERP',
          direction: 'short',
          notionalValue: '500.00',
        }),
      ],
      3,
    );

    expect(viewModel.topVenues).toEqual([
      expect.objectContaining({
        venue: 'hyperliquid',
        totalNotionalValue: 1000,
        walletCount: 2,
        openPositionCount: 2,
        totalLongNotionalValue: 1000,
        totalShortNotionalValue: 0,
      }),
      expect.objectContaining({
        venue: 'aster',
        totalNotionalValue: 500,
        walletCount: 1,
        openPositionCount: 1,
        totalLongNotionalValue: 0,
        totalShortNotionalValue: 500,
      }),
    ]);
  });

  it('limits ranked lists to the top three exposures', () => {
    const viewModel = buildExposureDashboardViewModel(
      [
        createPosition({ positionId: 'a', instrument: 'A-PERP', notionalValue: '100.00' }),
        createPosition({ positionId: 'b', instrument: 'B-PERP', notionalValue: '200.00' }),
        createPosition({ positionId: 'c', instrument: 'C-PERP', notionalValue: '300.00' }),
        createPosition({ positionId: 'd', instrument: 'D-PERP', notionalValue: '400.00' }),
      ],
      1,
    );

    expect(viewModel.topInstruments.map((summary) => summary.instrument)).toEqual([
      'D-PERP',
      'C-PERP',
      'B-PERP',
    ]);
  });
});
