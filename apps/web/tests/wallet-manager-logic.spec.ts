import { describe, expect, it } from 'vitest';

import type { WalletSlot } from '../lib/wallet/types';
import { getConnectorOptions, isConnectorLocked } from '../lib/wallet/wallet-manager-logic';

const connectedHyperliquidSlot: WalletSlot = {
  id: 'slot-1',
  accountId: '0x0000000000000000000000000000000000000002',
  venue: 'hyperliquid',
  connectorId: 'metaMaskInjected',
  label: 'MetaMask',
  lastConnectedAt: '2026-03-02T10:00:00.000Z',
  status: 'connected',
  ownershipStatus: 'verified',
  eligibilityStatus: 'tradable',
};

describe('wallet manager logic', () => {
  it('detects connector lock when another connected slot uses the connector', () => {
    const locked = isConnectorLocked([connectedHyperliquidSlot], 'metaMaskInjected');

    expect(locked).toBe(true);
  });

  it('ignores the provided slot id when checking connector lock', () => {
    const locked = isConnectorLocked([connectedHyperliquidSlot], 'metaMaskInjected', 'slot-1');

    expect(locked).toBe(false);
  });

  it('builds connector options with lock and disabled reasons', () => {
    const options = getConnectorOptions({
      slots: [connectedHyperliquidSlot],
      runtimeEnabled: true,
    });

    const metamask = options.find((option) => option.id === 'metaMaskInjected');
    const injected = options.find((option) => option.id === 'injected');

    expect(metamask).toEqual({
      id: 'metaMaskInjected',
      label: 'MetaMask',
      available: false,
      unavailableReason: 'connector-in-use',
    });
    expect(injected?.available).toBe(true);
  });
});
