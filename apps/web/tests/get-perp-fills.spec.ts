import { describe, expect, it } from 'vitest';

import { getPerpFills } from '../lib/market-data/get-perp-fills';

describe('getPerpFills', () => {
  it('fetches and validates perp fills payloads', async () => {
    const response = await getPerpFills(
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
                fills: [
                  {
                    id: 'fill_1',
                    accountId: '0xabc123',
                    venue: 'hyperliquid',
                    orderId: '37907159219',
                    instrument: 'ETH-PERP',
                    side: 'buy',
                    size: '0.0025',
                    price: '4307.4',
                    feeAmount: '0.004845',
                    feeAsset: 'USDC',
                    filledAt: '2026-03-09T14:00:00Z',
                  },
                ],
                source: 'hyperliquid',
              }),
          }) as Response,
      },
    );

    expect(response.venue).toBe('hyperliquid');
    expect(response.fills).toHaveLength(1);
    expect(response.fills[0]?.instrument).toBe('ETH-PERP');
  });

  it('throws for non-OK responses', async () => {
    await expect(
      getPerpFills(
        {
          accountId: '0xabc123',
          venue: 'hyperliquid',
        },
        {
          fetchImpl: async () =>
            ({
              ok: false,
              status: 501,
              text: async () => 'perp fills are not implemented for hyperliquid yet',
            }) as Response,
        },
      ),
    ).rejects.toThrow('perp fills are not implemented for hyperliquid yet');
  });
});
