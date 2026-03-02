import { describe, expect, it, vi } from 'vitest';

import { findFirstAvailableConnector, sortConnectorsForConnection } from '../lib/wallet/connector-utils';

describe('wallet connector utils', () => {
  it('prioritizes injected-style connectors ahead of other options', () => {
    const connectors = [
      { id: 'walletConnect' },
      { id: 'coinbaseWalletSDK' },
      { id: 'safe' },
      { id: 'injected' },
    ];

    expect(sortConnectorsForConnection(connectors).map((connector) => connector.id)).toEqual([
      'injected',
      'coinbaseWalletSDK',
      'walletConnect',
      'safe',
    ]);
  });

  it('returns the first connector that resolves a provider', async () => {
    const injected = {
      id: 'injected',
      getProvider: vi.fn().mockResolvedValue(undefined),
    };
    const coinbase = {
      id: 'coinbaseWalletSDK',
      getProvider: vi.fn().mockResolvedValue({ provider: 'coinbase' }),
    };
    const walletConnect = {
      id: 'walletConnect',
      getProvider: vi.fn().mockResolvedValue({ provider: 'wallet-connect' }),
    };

    const connector = await findFirstAvailableConnector([walletConnect, coinbase, injected]);

    expect(connector).toBe(coinbase);
    expect(injected.getProvider).toHaveBeenCalledTimes(1);
    expect(coinbase.getProvider).toHaveBeenCalledTimes(1);
    expect(walletConnect.getProvider).not.toHaveBeenCalled();
  });

  it('skips connectors whose provider lookup throws and reports no match when none are available', async () => {
    const broken = {
      id: 'injected',
      getProvider: vi.fn().mockRejectedValue(new Error('no provider')),
    };
    const missing = {
      id: 'walletConnect',
      getProvider: vi.fn().mockResolvedValue(null),
    };

    const connector = await findFirstAvailableConnector([missing, broken]);

    expect(connector).toBeNull();
    expect(broken.getProvider).toHaveBeenCalledTimes(1);
    expect(missing.getProvider).toHaveBeenCalledTimes(1);
  });
});
