import { describe, expect, it } from 'vitest';

import { getPerpPositions } from '../lib/market-data/get-perp-positions';

describe('getPerpPositions', () => {
  it('fetches and validates perp positions payloads', async () => {
    const response = await getPerpPositions(
      {
        accountId: '0xabc123',
        venue: 'hyperliquid',
      },
      {
        fetchImpl: async () =>
          ({
            ok: true,
            text: async () =>
              JSON.stringify({
                accountId: '0xabc123',
                venue: 'hyperliquid',
                positions: [
                  {
                    positionId: 'pos_1',
                    accountId: '0xabc123',
                    venue: 'hyperliquid',
                    instrument: 'ETH-PERP',
                    direction: 'long',
                    status: 'open',
                    size: '0.25',
                    entryPrice: '3200.00',
                    markPrice: '3250.00',
                    notionalValue: '812.50',
                    leverage: '3',
                    unrealizedPnlUsd: '12.50',
                    lastUpdatedAt: '2026-03-09T14:00:00Z',
                  },
                ],
                source: 'hyperliquid',
              }),
          }) as Response,
      },
    );

    expect(response.venue).toBe('hyperliquid');
    expect(response.positions).toHaveLength(1);
    expect(response.positions[0]?.positionId).toBe('pos_1');
    expect(response.positions[0]?.instrument).toBe('ETH-PERP');
  });

  it('throws for non-OK responses', async () => {
    await expect(
      getPerpPositions(
        {
          accountId: '0xabc123',
          venue: 'aster',
        },
        {
          fetchImpl: async () =>
            ({
              ok: false,
              status: 502,
              text: async () => 'upstream venue request failed',
            }) as Response,
        },
      ),
    ).rejects.toThrow('upstream venue request failed');
  });
});
