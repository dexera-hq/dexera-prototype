import { describe, expect, it } from 'vitest';
import type { BffPerpPositionsResponse } from '@dexera/api-types/openapi';

import {
  aggregateWalletPositions,
  collectConnectedPositionWallets,
  computePerpPositionMetrics,
} from '../lib/market-data/positions-engine';
import type { WalletSlot } from '../lib/wallet/types';

const connectedHyperliquidSlot: WalletSlot = {
  id: 'slot-hl',
  accountId: '0x0000000000000000000000000000000000000001',
  venue: 'hyperliquid',
  connectorId: 'metaMaskInjected',
  label: 'Primary',
  lastConnectedAt: '2026-03-09T10:00:00.000Z',
  status: 'connected',
  ownershipStatus: 'verified',
  eligibilityStatus: 'tradable',
};

describe('positions engine', () => {
  it('collects unique connected wallet inputs', () => {
    const disconnectedAsterSlot: WalletSlot = {
      ...connectedHyperliquidSlot,
      id: 'slot-as-disconnected',
      accountId: '0x0000000000000000000000000000000000000002',
      venue: 'aster',
      status: 'disconnected',
    };
    const duplicateHyperliquidSlot: WalletSlot = {
      ...connectedHyperliquidSlot,
      id: 'slot-hl-duplicate',
      accountId: '0x0000000000000000000000000000000000000001',
    };
    const connectedAsterSlot: WalletSlot = {
      ...connectedHyperliquidSlot,
      id: 'slot-as',
      accountId: '0x0000000000000000000000000000000000000003',
      venue: 'aster',
    };

    expect(
      collectConnectedPositionWallets([
        connectedHyperliquidSlot,
        duplicateHyperliquidSlot,
        disconnectedAsterSlot,
        connectedAsterSlot,
      ]),
    ).toEqual([
      {
        accountId: '0x0000000000000000000000000000000000000001',
        venue: 'hyperliquid',
      },
      {
        accountId: '0x0000000000000000000000000000000000000003',
        venue: 'aster',
      },
    ]);
  });

  it('computes unrealized pnl for long and short positions', () => {
    expect(
      computePerpPositionMetrics({
        direction: 'long',
        size: '2',
        entryPrice: '100',
        markPrice: '110',
      }),
    ).toEqual({
      unrealizedPnlUsd: '20.00',
      notionalValue: '220.00',
    });

    expect(
      computePerpPositionMetrics({
        direction: 'short',
        size: '2',
        entryPrice: '100',
        markPrice: '110',
      }),
    ).toEqual({
      unrealizedPnlUsd: '-20.00',
      notionalValue: '220.00',
    });
  });

  it('aggregates wallet responses into per-wallet rows with recomputed metrics', () => {
    const responses: BffPerpPositionsResponse[] = [
      {
        accountId: '0x0000000000000000000000000000000000000003',
        venue: 'aster',
        source: 'mock',
        positions: [
          {
            positionId: 'pos_as_1',
            accountId: '0x0000000000000000000000000000000000000003',
            venue: 'aster',
            instrument: 'ETH-PERP',
            direction: 'short',
            status: 'open',
            size: '1.50',
            entryPrice: '3200.00',
            markPrice: '3188.25',
            notionalValue: '9999.99',
            leverage: '3',
            unrealizedPnlUsd: '999.99',
            lastUpdatedAt: '2026-03-09T12:00:00Z',
          },
        ],
      },
      {
        accountId: '0x0000000000000000000000000000000000000001',
        venue: 'hyperliquid',
        source: 'hyperliquid',
        positions: [
          {
            positionId: 'pos_hl_1',
            accountId: '0x0000000000000000000000000000000000000001',
            venue: 'hyperliquid',
            instrument: 'BTC-PERP',
            direction: 'long',
            status: 'open',
            size: '0.25',
            entryPrice: '68120.00',
            markPrice: '68450.25',
            notionalValue: '0',
            leverage: '4',
            unrealizedPnlUsd: '0',
            lastUpdatedAt: '2026-03-09T12:01:00Z',
          },
        ],
      },
    ];

    expect(aggregateWalletPositions(responses)).toEqual([
      {
        positionId: 'pos_as_1',
        accountId: '0x0000000000000000000000000000000000000003',
        venue: 'aster',
        instrument: 'ETH-PERP',
        direction: 'short',
        size: '1.50',
        entryPrice: '3200.00',
        markPrice: '3188.25',
        unrealizedPnlUsd: '17.63',
        notionalValue: '4782.38',
        leverage: '3',
        status: 'open',
        lastUpdatedAt: '2026-03-09T12:00:00Z',
      },
      {
        positionId: 'pos_hl_1',
        accountId: '0x0000000000000000000000000000000000000001',
        venue: 'hyperliquid',
        instrument: 'BTC-PERP',
        direction: 'long',
        size: '0.25',
        entryPrice: '68120.00',
        markPrice: '68450.25',
        unrealizedPnlUsd: '82.56',
        notionalValue: '17112.56',
        leverage: '4',
        status: 'open',
        lastUpdatedAt: '2026-03-09T12:01:00Z',
      },
    ]);
  });
});
