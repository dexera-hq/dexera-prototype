import { describe, expect, it } from 'vitest';

import { buildUnsignedCancelAction } from '../lib/wallet/build-unsigned-cancel-action';

describe('buildUnsignedCancelAction', () => {
  it('builds and validates unsigned Hyperliquid cancel payloads', async () => {
    const response = await buildUnsignedCancelAction(
      {
        cancel: {
          accountId: '0xabc123',
          venue: 'hyperliquid',
          instrument: 'BTC-PERP',
          orderId: 'ord_hl_1',
          venueOrderId: '918273645',
        },
      },
      {
        fetchImpl: async () =>
          ({
            ok: true,
            json: async () => ({
              orderId: 'ord_hl_1',
              signingPolicy: 'client-signing-only',
              disclaimer: 'Actions are prepared server-side as unsigned payloads only.',
              unsignedActionPayload: {
                id: 'uap_hl_cancel_1',
                accountId: '0xabc123',
                venue: 'hyperliquid',
                kind: 'perp_cancel_action',
                action: {
                  action: {
                    type: 'cancel',
                  },
                  nonce: 1733000000000,
                },
                walletRequest: {
                  method: 'eth_signTypedData_v4',
                  params: ['0xabc123', '{}'],
                },
              },
            }),
          }) as Response,
      },
    );

    expect(response.orderId).toBe('ord_hl_1');
    expect(response.unsignedActionPayload.kind).toBe('perp_cancel_action');
  });

  it('throws for non-OK cancel build responses', async () => {
    await expect(
      buildUnsignedCancelAction(
        {
          cancel: {
            accountId: '0xabc123',
            venue: 'hyperliquid',
            instrument: 'BTC-PERP',
            orderId: 'ord_hl_1',
            venueOrderId: '918273645',
          },
        },
        {
          fetchImpl: async () =>
            ({
              ok: false,
              status: 501,
              json: async () => ({}),
            }) as Response,
        },
      ),
    ).rejects.toThrow('Unsigned cancel action build failed with status 501.');
  });

  it('rejects array responses before field validation', async () => {
    await expect(
      buildUnsignedCancelAction(
        {
          cancel: {
            accountId: '0xabc123',
            venue: 'hyperliquid',
            instrument: 'BTC-PERP',
            orderId: 'ord_hl_1',
            venueOrderId: '918273645',
          },
        },
        {
          fetchImpl: async () =>
            ({
              ok: true,
              json: async () => [],
            }) as Response,
        },
      ),
    ).rejects.toThrow('Unsigned cancel action build response must be a JSON object.');
  });

  it('rejects non-cancel unsigned payloads', async () => {
    await expect(
      buildUnsignedCancelAction(
        {
          cancel: {
            accountId: '0xabc123',
            venue: 'hyperliquid',
            instrument: 'BTC-PERP',
            orderId: 'ord_hl_1',
            venueOrderId: '918273645',
          },
        },
        {
          fetchImpl: async () =>
            ({
              ok: true,
              json: async () => ({
                orderId: 'ord_hl_1',
                signingPolicy: 'client-signing-only',
                disclaimer: 'Actions are prepared server-side as unsigned payloads only.',
                unsignedActionPayload: {
                  id: 'uap_hl_order_1',
                  accountId: '0xabc123',
                  venue: 'hyperliquid',
                  kind: 'perp_order_action',
                  action: {
                    action: {
                      type: 'order',
                    },
                    nonce: 1733000000000,
                  },
                  walletRequest: {
                    method: 'eth_signTypedData_v4',
                    params: ['0xabc123', '{}'],
                  },
                },
              }),
            }) as Response,
        },
      ),
    ).rejects.toThrow('Unsigned cancel action response must include a perp_cancel_action payload.');
  });
});
