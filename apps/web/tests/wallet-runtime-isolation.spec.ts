import { describe, expect, it } from 'vitest';

import type { WalletSlot } from '../lib/wallet/types';
import { getConnectorOptions } from '../lib/wallet/wallet-manager-logic';

function createSlot(overrides: Partial<WalletSlot>): WalletSlot {
  return {
    id: 'slot-default',
    accountId: '0x0000000000000000000000000000000000000002',
    venue: 'hyperliquid',
    connectorId: 'metaMaskInjected',
    label: 'MetaMask',
    lastConnectedAt: '2026-03-02T10:00:00.000Z',
    status: 'connected',
    ownershipStatus: 'verified',
    eligibilityStatus: 'tradable',
    ...overrides,
  };
}

describe('wallet runtime isolation rules', () => {
  it('prevents opening a second live slot on a connector already in use', () => {
    const slots: WalletSlot[] = [
      createSlot({ id: 'slot-a', connectorId: 'metaMaskInjected', status: 'connected' }),
    ];

    const options = getConnectorOptions({ slots, runtimeEnabled: true });

    expect(options.find((option) => option.id === 'metaMaskInjected')).toEqual({
      id: 'metaMaskInjected',
      label: 'MetaMask',
      available: false,
      unavailableReason: 'connector-in-use',
    });
  });

  it('allows reconnecting a disconnected slot when no other live slot owns its connector', () => {
    const slots: WalletSlot[] = [
      createSlot({ id: 'slot-a', connectorId: 'metaMaskInjected', status: 'disconnected' }),
      createSlot({
        id: 'slot-b',
        connectorId: 'coinbaseInjected',
        venue: 'aster',
        status: 'connected',
      }),
    ];

    const options = getConnectorOptions({
      slots,
      runtimeEnabled: true,
      activeSlotId: 'slot-a',
    });

    expect(options.find((option) => option.id === 'metaMaskInjected')?.available).toBe(true);
    expect(options.find((option) => option.id === 'coinbaseInjected')?.available).toBe(false);
  });
});
