import { describe, expect, it } from 'vitest';

import { submitSignedAction } from '../lib/wallet/submit-signed-action';

describe('submitSignedAction', () => {
  it('submits signed actions and returns normalized response fields', async () => {
    const response = await submitSignedAction(
      {
        orderId: 'ord_hl_1',
        signature: '0x' + '11'.repeat(65),
        unsignedActionPayload: {
          id: 'uap_hl_1',
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
      },
      {
        fetchImpl: async () =>
          ({
            ok: true,
            json: async () => ({
              orderId: 'ord_hl_1',
              actionHash: '0xhash_1',
              venue: 'hyperliquid',
              status: 'submitted',
              venueOrderId: '918273',
              source: 'hyperliquid',
            }),
          }) as Response,
      },
    );

    expect(response.orderId).toBe('ord_hl_1');
    expect(response.actionHash).toBe('0xhash_1');
    expect(response.venueOrderId).toBe('918273');
  });

  it('throws for non-OK submit responses', async () => {
    await expect(
      submitSignedAction(
        {
          orderId: 'ord_hl_2',
          signature: '0x' + '22'.repeat(65),
          unsignedActionPayload: {
            id: 'uap_hl_2',
            accountId: '0xabc123',
            venue: 'hyperliquid',
            kind: 'perp_order_action',
            action: {
              action: {
                type: 'order',
              },
              nonce: 1733000000001,
            },
            walletRequest: {
              method: 'eth_signTypedData_v4',
            },
          },
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
    ).rejects.toThrow('Signed action submission failed with status 502.');
  });
});
