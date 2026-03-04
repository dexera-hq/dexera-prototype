import { describe, expect, it } from 'vitest';

import { submitUnsignedAction } from '../lib/wallet/sign-unsigned-transaction';
import {
  TransactionGuardrailError,
  assertPayloadMatchesActiveWallet,
  validateUnsignedActionPayload,
} from '../lib/wallet/transaction-guardrails';
import type { WalletSlot } from '../lib/wallet/types';

const activeWallet: WalletSlot = {
  id: 'wallet-1',
  accountId: '0x0000000000000000000000000000000000000001',
  venue: 'hyperliquid',
  connectorId: 'metaMaskInjected',
  lastConnectedAt: '2026-03-02T10:00:00.000Z',
  status: 'connected',
  ownershipStatus: 'verified',
  eligibilityStatus: 'tradable',
};

describe('transaction guardrails', () => {
  it('accepts a valid unsigned action payload', () => {
    const result = validateUnsignedActionPayload({
      id: 'uap_1',
      accountId: '0x0000000000000000000000000000000000000001',
      venue: 'hyperliquid',
      kind: 'perp_order_action',
      action: {
        instrument: 'BTC-PERP',
        side: 'buy',
      },
    });

    expect(result.ok).toBe(true);
  });

  it('rejects a payload that includes signed action fields', () => {
    const result = validateUnsignedActionPayload({
      id: 'uap_1',
      accountId: '0x0000000000000000000000000000000000000001',
      venue: 'hyperliquid',
      kind: 'perp_order_action',
      action: {
        instrument: 'BTC-PERP',
      },
      actionHash: '0xabc',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected signed payload rejection');
    }
    expect(result.error.code).toBe('signed-field-present');
  });

  it('rejects venue mismatches against the active wallet', () => {
    expect(() =>
      assertPayloadMatchesActiveWallet(
        {
          id: 'uap_1',
          accountId: '0x0000000000000000000000000000000000000001',
          venue: 'aster',
          kind: 'perp_order_action',
          action: {
            instrument: 'BTC-PERP',
          },
        },
        activeWallet,
      ),
    ).toThrow(TransactionGuardrailError);
  });

  it('submits a validated payload only from the client context', async () => {
    const globalWindow = globalThis as typeof globalThis & { window?: Window };
    const previousWindow = globalWindow.window;
    Object.defineProperty(globalWindow, 'window', {
      value: {} as Window & typeof globalThis,
      configurable: true,
    });

    try {
      const result = await submitUnsignedAction({
        payload: {
          id: 'uap_1',
          accountId: '0x0000000000000000000000000000000000000001',
          venue: 'hyperliquid',
          kind: 'perp_order_action',
          action: {
            instrument: 'BTC-PERP',
          },
        },
        activeWallet,
        submitter: {
          sendAction: async () => 'action_hash_1',
        },
      });

      expect(result.actionHash).toBe('action_hash_1');
      expect(result.accountId).toBe(activeWallet.accountId);
    } finally {
      if (previousWindow === undefined) {
        Reflect.deleteProperty(globalWindow, 'window');
      } else {
        Object.defineProperty(globalWindow, 'window', {
          value: previousWindow,
          configurable: true,
        });
      }
    }
  });

  it('rejects account mismatches against the active wallet', () => {
    expect(() =>
      assertPayloadMatchesActiveWallet(
        {
          id: 'uap_1',
          accountId: '0x00000000000000000000000000000000000000ff',
          venue: 'hyperliquid',
          kind: 'perp_order_action',
          action: {
            instrument: 'BTC-PERP',
          },
        },
        activeWallet,
      ),
    ).toThrow(TransactionGuardrailError);
  });
});
