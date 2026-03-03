import { describe, expect, it } from 'vitest';

import { signUnsignedTransaction } from '../lib/wallet/sign-unsigned-transaction';
import {
  TransactionGuardrailError,
  assertPayloadMatchesActiveWallet,
  validateUnsignedTxPayload,
} from '../lib/wallet/transaction-guardrails';
import type { WalletSlot } from '../lib/wallet/types';

const activeWallet: WalletSlot = {
  id: 'wallet-1',
  walletAddress: '0x1111',
  chainId: 1,
  connectorId: 'injected',
  lastConnectedAt: '2026-03-02T10:00:00.000Z',
  status: 'connected',
};

describe('transaction guardrails', () => {
  it('accepts a valid unsigned transaction payload', () => {
    const result = validateUnsignedTxPayload({
      id: 'utxp_1',
      chainId: 1,
      kind: 'evm_transaction',
      to: '0x1111111111111111111111111111111111111111',
      data: '0xdeadbeef',
      value: '0',
    });

    expect(result.ok).toBe(true);
  });

  it('rejects a payload that includes signed transaction fields', () => {
    const result = validateUnsignedTxPayload({
      id: 'utxp_1',
      chainId: 1,
      kind: 'evm_transaction',
      to: '0x1111111111111111111111111111111111111111',
      data: '0xdeadbeef',
      value: '0',
      txHash: '0xabc',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('Expected signed payload rejection');
    }
    expect(result.error.code).toBe('signed-field-present');
  });

  it('rejects chain mismatches against the active wallet', () => {
    expect(() =>
      assertPayloadMatchesActiveWallet(
        {
          id: 'utxp_1',
          chainId: 999,
          kind: 'evm_transaction',
          to: '0x1111111111111111111111111111111111111111',
          data: '0xdeadbeef',
          value: '0',
        },
        activeWallet,
      ),
    ).toThrow(TransactionGuardrailError);
  });

  it('signs a validated payload only from the client context', async () => {
    const globalWindow = globalThis as typeof globalThis & { window?: Window };
    const previousWindow = globalWindow.window;
    Object.defineProperty(globalWindow, 'window', {
      value: {} as Window & typeof globalThis,
      configurable: true,
    });

    try {
      const result = await signUnsignedTransaction({
        payload: {
          id: 'utxp_1',
          chainId: 1,
          kind: 'evm_transaction',
          to: '0x1111111111111111111111111111111111111111',
          data: '0xdeadbeef',
          value: '0',
        },
        activeWallet,
        signer: {
          signTransaction: async () => '0xsigned',
        },
      });

      expect(result.signedTransaction).toBe('0xsigned');
      expect(result.walletAddress).toBe(activeWallet.walletAddress);
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
});
