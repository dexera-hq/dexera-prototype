import { describe, expect, it } from 'vitest';

import { getPerpOrderStatus } from '../lib/wallet/get-perp-order-status';

describe('getPerpOrderStatus', () => {
  it('fetches and validates hyperliquid order status payloads', async () => {
    const response = await getPerpOrderStatus(
      {
        accountId: '0xabc123',
        venue: 'hyperliquid',
        venueOrderId: '918273645',
        orderId: 'ord_hl_1',
      },
      {
        fetchImpl: async () =>
          ({
            ok: true,
            json: async () => ({
              accountId: '0xabc123',
              venue: 'hyperliquid',
              orderId: 'ord_hl_1',
              venueOrderId: '918273645',
              status: 'open',
              venueStatus: 'open',
              isTerminal: false,
              lastUpdatedAt: '2026-03-05T14:00:00Z',
              source: 'hyperliquid',
            }),
          }) as Response,
      },
    );

    expect(response.status).toBe('open');
    expect(response.venueOrderId).toBe('918273645');
    expect(response.isTerminal).toBe(false);
  });

  it('throws for non-OK responses', async () => {
    await expect(
      getPerpOrderStatus(
        {
          accountId: '0xabc123',
          venue: 'hyperliquid',
          venueOrderId: '918273645',
        },
        {
          fetchImpl: async () =>
            ({
              ok: false,
              status: 502,
              json: async () => ({}),
            }) as Response,
        },
      ),
    ).rejects.toThrow('Perp order status request failed with status 502.');
  });
});
