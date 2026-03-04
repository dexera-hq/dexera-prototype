import { describe, expect, it, vi } from 'vitest';

import {
  findFirstAvailableConnector,
  sortConnectorsForConnection,
} from '../lib/wallet/connector-utils';

describe('wallet connector utils', () => {
  it('prioritizes explicit injected connectors ahead of generic options', () => {
    const connectors = [{ id: 'injected' }, { id: 'safe' }, { id: 'metaMaskInjected' }];

    expect(sortConnectorsForConnection(connectors).map((connector) => connector.id)).toEqual([
      'metaMaskInjected',
      'injected',
      'safe',
    ]);
  });

  it('returns the first connector that resolves a provider', async () => {
    const metamask = {
      id: 'metaMaskInjected',
      getProvider: vi.fn().mockResolvedValue({ provider: 'metamask' }),
    };
    const injected = {
      id: 'injected',
      getProvider: vi.fn().mockResolvedValue({ provider: 'injected' }),
    };

    const connector = await findFirstAvailableConnector([injected, metamask]);

    expect(connector).toBe(metamask);
    expect(metamask.getProvider).toHaveBeenCalledTimes(1);
    expect(injected.getProvider).toHaveBeenCalledTimes(0);
  });

  it('skips connectors whose provider lookup throws and reports no match when none are available', async () => {
    const broken = {
      id: 'metaMaskInjected',
      getProvider: vi.fn().mockRejectedValue(new Error('no provider')),
    };
    const missing = {
      id: 'injected',
      getProvider: vi.fn().mockResolvedValue(null),
    };

    const connector = await findFirstAvailableConnector([missing, broken]);

    expect(connector).toBeNull();
    expect(broken.getProvider).toHaveBeenCalledTimes(1);
    expect(missing.getProvider).toHaveBeenCalledTimes(1);
  });
});
