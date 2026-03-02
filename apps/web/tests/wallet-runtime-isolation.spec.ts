import { describe, expect, it } from 'vitest';

import type { WalletSlot } from '../lib/wallet/types';
import { getConnectorOptions } from '../lib/wallet/wallet-manager-logic';

function createSlot(overrides: Partial<WalletSlot>): WalletSlot {
  return {
    id: 'slot-default',
    address: '0x1111',
    chainId: 1,
    connectorId: 'injected',
    label: 'Injected',
    lastConnectedAt: '2026-03-02T10:00:00.000Z',
    status: 'connected',
    ...overrides,
  };
}

describe('wallet runtime isolation rules', () => {
  it('prevents opening a second live slot on a connector already in use', () => {
    const slots: WalletSlot[] = [
      createSlot({ id: 'slot-a', connectorId: 'injected', status: 'connected' }),
    ];

    const options = getConnectorOptions({ slots, walletConnectEnabled: true });

    expect(options.find((option) => option.id === 'injected')).toEqual({
      id: 'injected',
      label: 'Injected',
      available: false,
      unavailableReason: 'connector-in-use',
    });
  });

  it('allows reconnecting a disconnected slot when no other live slot owns its connector', () => {
    const slots: WalletSlot[] = [
      createSlot({ id: 'slot-a', connectorId: 'injected', status: 'disconnected' }),
      createSlot({ id: 'slot-b', connectorId: 'coinbaseWalletSDK', status: 'connected' }),
    ];

    const options = getConnectorOptions({
      slots,
      walletConnectEnabled: true,
      activeSlotId: 'slot-a',
    });

    expect(options.find((option) => option.id === 'injected')?.available).toBe(true);
    expect(options.find((option) => option.id === 'coinbaseWalletSDK')?.available).toBe(false);
  });
});
