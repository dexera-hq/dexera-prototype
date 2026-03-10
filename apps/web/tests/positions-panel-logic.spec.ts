import { describe, expect, it } from 'vitest';

import { buildOpenPositionsViewModel } from '../components/workspace/positions-panel-logic';
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

describe('positions panel logic', () => {
  it('filters out non-open positions before building wallet groups', () => {
    const viewModel = buildOpenPositionsViewModel([
      createPosition({ positionId: 'open-1', status: 'open' }),
      createPosition({ positionId: 'closed-1', status: 'closed', notionalValue: '999999.00' }),
      createPosition({ positionId: 'liq-1', status: 'liquidated', notionalValue: '999999.00' }),
    ]);

    expect(viewModel.openPositionCount).toBe(1);
    expect(viewModel.groups).toHaveLength(1);
    expect(viewModel.groups[0]?.positions.map((position) => position.positionId)).toEqual(['open-1']);
  });

  it('groups positions by wallet account and venue together', () => {
    const viewModel = buildOpenPositionsViewModel([
      createPosition({
        positionId: 'hl-1',
        accountId: '0xwallet',
        venue: 'hyperliquid',
      }),
      createPosition({
        positionId: 'as-1',
        accountId: '0xwallet',
        venue: 'aster',
      }),
      createPosition({
        positionId: 'hl-2',
        accountId: '0xother',
        venue: 'hyperliquid',
      }),
    ]);

    expect(viewModel.groups).toHaveLength(3);
    expect(viewModel.groups.map((group) => `${group.accountId}:${group.venue}`)).toEqual([
      '0xother:hyperliquid',
      '0xwallet:aster',
      '0xwallet:hyperliquid',
    ]);
  });

  it('computes wallet totals and sorts groups by total exposure descending', () => {
    const viewModel = buildOpenPositionsViewModel([
      createPosition({
        positionId: 'wallet-a-1',
        accountId: '0xwallet-a',
        notionalValue: '700.00',
        unrealizedPnlUsd: '15.00',
      }),
      createPosition({
        positionId: 'wallet-a-2',
        accountId: '0xwallet-a',
        notionalValue: '500.00',
        unrealizedPnlUsd: '-5.00',
      }),
      createPosition({
        positionId: 'wallet-b-1',
        accountId: '0xwallet-b',
        notionalValue: '900.00',
        unrealizedPnlUsd: '7.00',
      }),
    ]);

    expect(viewModel.totalNotionalValue).toBe(2100);
    expect(viewModel.totalUnrealizedPnlUsd).toBe(17);
    expect(viewModel.groups.map((group) => group.accountId)).toEqual(['0xwallet-a', '0xwallet-b']);
    expect(viewModel.groups[0]).toMatchObject({
      accountId: '0xwallet-a',
      totalNotionalValue: 1200,
      totalUnrealizedPnlUsd: 10,
      openPositionCount: 2,
    });
  });

  it('sorts rows inside each wallet by exposure descending', () => {
    const viewModel = buildOpenPositionsViewModel([
      createPosition({
        positionId: 'small',
        notionalValue: '50.00',
        instrument: 'SOL-PERP',
      }),
      createPosition({
        positionId: 'large',
        notionalValue: '500.00',
        instrument: 'BTC-PERP',
      }),
      createPosition({
        positionId: 'medium',
        notionalValue: '250.00',
        instrument: 'ETH-PERP',
      }),
    ]);

    expect(viewModel.groups[0]?.positions.map((position) => position.positionId)).toEqual([
      'large',
      'medium',
      'small',
    ]);
  });

  it('uses each position mark price as the current price in the display model', () => {
    const viewModel = buildOpenPositionsViewModel([
      createPosition({
        positionId: 'mark-source',
        markPrice: '3199.55',
        entryPrice: '3000.00',
      }),
    ]);

    expect(viewModel.groups[0]?.positions[0]).toMatchObject({
      positionId: 'mark-source',
      currentPrice: '3199.55',
      entryPrice: '3000.00',
    });
  });
});
