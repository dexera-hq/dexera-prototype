import { describe, expect, it } from 'vitest';

import type { WalletSlot } from '../lib/wallet/types';
import { getConnectorOptions, isConnectorLocked } from '../lib/wallet/wallet-manager-logic';

const connectedInjectedSlot: WalletSlot = {
  id: 'slot-1',
  address: '0x1111',
  chainId: 1,
  connectorId: 'injected',
  label: 'Injected',
  lastConnectedAt: '2026-03-02T10:00:00.000Z',
  status: 'connected',
};

describe('wallet manager logic', () => {
  it('detects connector lock when another connected slot uses the connector', () => {
    const locked = isConnectorLocked([connectedInjectedSlot], 'injected');

    expect(locked).toBe(true);
  });

  it('ignores the provided slot id when checking connector lock', () => {
    const locked = isConnectorLocked([connectedInjectedSlot], 'injected', 'slot-1');

    expect(locked).toBe(false);
  });

  it('builds connector options with lock and disabled reasons', () => {
    const options = getConnectorOptions({
      slots: [connectedInjectedSlot],
      walletConnectEnabled: false,
    });

    const injected = options.find((option) => option.id === 'injected');
    const coinbase = options.find((option) => option.id === 'coinbaseWalletSDK');
    const walletConnect = options.find((option) => option.id === 'walletConnect');

    expect(injected).toEqual({
      id: 'injected',
      label: 'Injected',
      available: false,
      unavailableReason: 'connector-in-use',
    });
    expect(coinbase?.available).toBe(true);
    expect(walletConnect).toEqual({
      id: 'walletConnect',
      label: 'WalletConnect',
      available: false,
      unavailableReason: 'connector-disabled',
    });
  });
});
