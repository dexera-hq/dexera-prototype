import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearRuntimeSlots,
  connectRuntimeSlot,
  reconnectRuntimeSlot,
  signAndSubmitRuntimeSlotAction,
  signRuntimeSlotActionPayload,
  signRuntimeSlotMessage,
  watchRuntimeSlotAccount,
} from '../lib/wallet/multi-session-runtime';

const RUNTIME_TEST_SLOT_IDS = [
  'slot-a',
  'slot-b',
  'slot-c',
  'slot-d',
  'slot-e',
  'slot-f',
  'slot-g',
  'slot-h',
  'slot-i',
] as const;
const runtimeGlobal = globalThis as unknown as { window?: unknown };
const originalWindow = runtimeGlobal.window;
const originalHyperliquidSigningRPCURL = process.env.NEXT_PUBLIC_HYPERLIQUID_SIGNING_CHAIN_RPC_URL;

function setRuntimeWindow(value: unknown): void {
  runtimeGlobal.window = value;
}

type RuntimeRequest = (parameters: { method: string }) => Promise<unknown>;

function createEventfulProvider(requestImpl: RuntimeRequest): {
  request: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  emit: (eventName: string, ...args: unknown[]) => void;
  isMetaMask: true;
} {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const request = vi.fn(requestImpl);
  const on = vi.fn((eventName: string, listener: (...args: unknown[]) => void) => {
    const existing = listeners.get(eventName) ?? new Set<(...args: unknown[]) => void>();
    existing.add(listener);
    listeners.set(eventName, existing);
  });
  const removeListener = vi.fn((eventName: string, listener: (...args: unknown[]) => void) => {
    listeners.get(eventName)?.delete(listener);
  });
  const emit = (eventName: string, ...args: unknown[]): void => {
    for (const listener of listeners.get(eventName) ?? []) {
      listener(...args);
    }
  };

  return {
    request,
    on,
    removeListener,
    emit,
    isMetaMask: true,
  };
}

afterEach(async () => {
  await clearRuntimeSlots(RUNTIME_TEST_SLOT_IDS);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalHyperliquidSigningRPCURL === undefined) {
    delete process.env.NEXT_PUBLIC_HYPERLIQUID_SIGNING_CHAIN_RPC_URL;
  } else {
    process.env.NEXT_PUBLIC_HYPERLIQUID_SIGNING_CHAIN_RPC_URL = originalHyperliquidSigningRPCURL;
  }

  if (originalWindow === undefined) {
    delete runtimeGlobal.window;
    return;
  }

  runtimeGlobal.window = originalWindow;
});

describe('multi-session runtime wallet connections', () => {
  it('does not connect when no wallet provider is available', async () => {
    delete runtimeGlobal.window;

    const result = await connectRuntimeSlot('slot-a', 'metaMaskInjected');

    expect(result).toEqual({
      connected: false,
      reason: 'connector-missing',
    });
  });

  it('requests accounts during connect and stores the connected address', async () => {
    const request = vi.fn().mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'wallet_requestPermissions') {
        return [{ parentCapability: 'eth_accounts' }];
      }

      if (method === 'eth_requestAccounts') {
        return ['0xAbC123'];
      }

      return [];
    });
    setRuntimeWindow({
      ethereum: {
        providers: [{ request, isMetaMask: true }],
      },
    });

    const result = await connectRuntimeSlot('slot-b', 'metaMaskInjected');

    expect(request).toHaveBeenNthCalledWith(1, {
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });
    expect(request).toHaveBeenNthCalledWith(2, { method: 'eth_requestAccounts' });
    expect(result.connected).toBe(true);
    expect(result.reason).toBe('connected');
    expect(result.account?.accountId).toBe('0xabc123');
    expect(result.account?.connectorId).toBe('metaMaskInjected');
  });

  it('falls back to eth_requestAccounts when permission requests are unsupported', async () => {
    const unsupportedPermissionsError = Object.assign(new Error('unsupported method'), {
      code: 4200,
    });
    const request = vi.fn().mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'wallet_requestPermissions') {
        throw unsupportedPermissionsError;
      }

      if (method === 'eth_requestAccounts') {
        return ['0xdef456'];
      }

      return [];
    });
    setRuntimeWindow({
      ethereum: {
        providers: [{ request, isCoinbaseWallet: true }],
      },
    });

    const result = await connectRuntimeSlot('slot-e', 'coinbaseInjected');

    expect(request).toHaveBeenNthCalledWith(1, {
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }],
    });
    expect(request).toHaveBeenNthCalledWith(2, { method: 'eth_requestAccounts' });
    expect(result.connected).toBe(true);
    expect(result.account?.accountId).toBe('0xdef456');
  });

  it('uses passive account checks on reconnect and fails when no account is available', async () => {
    const request = vi.fn().mockResolvedValue([]);
    setRuntimeWindow({
      ethereum: {
        providers: [{ request, isRabby: true }],
      },
    });

    const result = await reconnectRuntimeSlot('slot-c', 'rabbyInjected');

    expect(request).toHaveBeenCalledWith({ method: 'eth_accounts' });
    expect(result).toEqual({
      connected: false,
      reason: 'failed',
    });
  });

  it('does not use a non-matching injected provider for an explicit connector', async () => {
    const fallbackRequest = vi.fn().mockResolvedValue(['0x222']);
    setRuntimeWindow({
      ethereum: {
        providers: [
          {
            request: fallbackRequest,
            isCoinbaseWallet: true,
          },
        ],
      },
    });

    const result = await connectRuntimeSlot('slot-d', 'metaMaskInjected');

    expect(result).toEqual({
      connected: false,
      reason: 'connector-missing',
    });
    expect(fallbackRequest).not.toHaveBeenCalled();
  });

  it('uses generic injected connector when no named wallet marker matches', async () => {
    const fallbackRequest = vi.fn().mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'wallet_requestPermissions') {
        return [{ parentCapability: 'eth_accounts' }];
      }

      if (method === 'eth_requestAccounts') {
        return ['0xfeed01'];
      }

      return [];
    });
    setRuntimeWindow({
      ethereum: {
        providers: [
          {
            request: fallbackRequest,
            name: 'Custom Wallet',
          },
        ],
      },
    });

    const result = await connectRuntimeSlot('slot-f', 'injected');

    expect(result.connected).toBe(true);
    expect(result.reason).toBe('connected');
    expect(result.account?.accountId).toBe('0xfeed01');
    expect(result.account?.connectorId).toBe('injected');
  });

  it('signs challenge messages through personal_sign for connected slots', async () => {
    const request = vi.fn().mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'wallet_requestPermissions') {
        return [{ parentCapability: 'eth_accounts' }];
      }
      if (method === 'eth_requestAccounts') {
        return ['0xabc123'];
      }
      if (method === 'personal_sign') {
        return '0x' + '11'.repeat(65);
      }

      return [];
    });

    setRuntimeWindow({
      ethereum: {
        providers: [{ request, isMetaMask: true }],
      },
    });

    await connectRuntimeSlot('slot-b', 'metaMaskInjected');
    const signature = await signRuntimeSlotMessage({
      slotId: 'slot-b',
      accountId: '0xabc123',
      message: 'Sign me',
    });

    expect(signature).toBe('0x' + '11'.repeat(65));
    expect(request).toHaveBeenCalledWith({
      method: 'personal_sign',
      params: ['Sign me', '0xabc123'],
    });
  });

  it('submits runtime slot actions through the wallet request envelope', async () => {
    const request = vi.fn().mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'wallet_requestPermissions') {
        return [{ parentCapability: 'eth_accounts' }];
      }
      if (method === 'eth_requestAccounts') {
        return ['0xabc123'];
      }
      if (method === 'wallet_perp_submitAction') {
        return '0xactionhash';
      }
      return [];
    });

    setRuntimeWindow({
      ethereum: {
        providers: [{ request, isMetaMask: true }],
      },
    });

    await connectRuntimeSlot('slot-g', 'metaMaskInjected');

    const actionHash = await signAndSubmitRuntimeSlotAction({
      slotId: 'slot-g',
      accountId: '0xabc123',
      payload: {
        id: 'uap_1',
        accountId: '0xabc123',
        venue: 'hyperliquid',
        kind: 'perp_order_action',
        action: {
          instrument: 'BTC-PERP',
        },
        walletRequest: {
          method: 'wallet_perp_submitAction',
          params: [{ payloadId: 'uap_1' }],
        },
      },
    });

    expect(actionHash).toBe('0xactionhash');
    expect(request).toHaveBeenCalledWith({
      method: 'wallet_perp_submitAction',
      params: [{ payloadId: 'uap_1' }],
    });
  });

  it('signs action payloads through wallet typed-data requests', async () => {
    const request = vi.fn().mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'wallet_requestPermissions') {
        return [{ parentCapability: 'eth_accounts' }];
      }
      if (method === 'eth_requestAccounts') {
        return ['0xabc123'];
      }
      if (method === 'eth_signTypedData_v4') {
        return '0x' + '22'.repeat(65);
      }
      return [];
    });

    setRuntimeWindow({
      ethereum: {
        providers: [{ request, isMetaMask: true }],
      },
    });

    await connectRuntimeSlot('slot-g', 'metaMaskInjected');

    const signature = await signRuntimeSlotActionPayload({
      slotId: 'slot-g',
      accountId: '0xabc123',
      payload: {
        id: 'uap_hl_typed_1',
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
          params: ['0xabc123', '{"types":{}}'],
        },
      },
    });

    expect(signature).toBe('0x' + '22'.repeat(65));
    expect(request).toHaveBeenCalledWith({
      method: 'eth_signTypedData_v4',
      params: ['0xabc123', '{"types":{}}'],
    });
  });

  it('switches wallet chain before hyperliquid typed-data signing', async () => {
    const request = vi.fn().mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'wallet_requestPermissions') {
        return [{ parentCapability: 'eth_accounts' }];
      }
      if (method === 'eth_requestAccounts') {
        return ['0xabc123'];
      }
      if (method === 'eth_chainId') {
        return '0x66eee';
      }
      if (method === 'wallet_switchEthereumChain') {
        return null;
      }
      if (method === 'eth_signTypedData_v4') {
        return '0x' + '23'.repeat(65);
      }
      return [];
    });

    setRuntimeWindow({
      ethereum: {
        providers: [{ request, isMetaMask: true }],
      },
    });

    await connectRuntimeSlot('slot-g', 'metaMaskInjected');

    const signature = await signRuntimeSlotActionPayload({
      slotId: 'slot-g',
      accountId: '0xabc123',
      payload: {
        id: 'uap_hl_typed_2',
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
          params: ['0xabc123', '{"domain":{"chainId":1337},"types":{}}'],
        },
      },
    });

    expect(signature).toBe('0x' + '23'.repeat(65));
    expect(request).toHaveBeenCalledWith({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x539' }],
    });
  });

  it('adds missing chain through configured rpc and retries switch before signing', async () => {
    process.env.NEXT_PUBLIC_HYPERLIQUID_SIGNING_CHAIN_RPC_URL = 'http://127.0.0.1:8545';
    let switchAttempts = 0;
    const request = vi
      .fn()
      .mockImplementation(async ({ method, params }: { method: string; params?: unknown[] }) => {
        if (method === 'wallet_requestPermissions') {
          return [{ parentCapability: 'eth_accounts' }];
        }
        if (method === 'eth_requestAccounts') {
          return ['0xabc123'];
        }
        if (method === 'eth_chainId') {
          return '0x66eee';
        }
        if (method === 'wallet_switchEthereumChain') {
          switchAttempts += 1;
          if (switchAttempts === 1) {
            throw Object.assign(new Error('Unrecognized chain ID "0x539".'), { code: 4902 });
          }
          return null;
        }
        if (method === 'wallet_addEthereumChain') {
          expect(params).toEqual([
            {
              chainId: '0x539',
              chainName: 'Anvil 1337',
              nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: ['http://127.0.0.1:8545'],
            },
          ]);
          return null;
        }
        if (method === 'eth_signTypedData_v4') {
          return '0x' + '24'.repeat(65);
        }
        return [];
      });

    setRuntimeWindow({
      ethereum: {
        providers: [{ request, isMetaMask: true }],
      },
    });

    await connectRuntimeSlot('slot-g', 'metaMaskInjected');

    const signature = await signRuntimeSlotActionPayload({
      slotId: 'slot-g',
      accountId: '0xabc123',
      payload: {
        id: 'uap_hl_typed_3',
        accountId: '0xabc123',
        venue: 'hyperliquid',
        kind: 'perp_order_action',
        action: {
          action: {
            type: 'order',
          },
          nonce: 1733000000002,
        },
        walletRequest: {
          method: 'eth_signTypedData_v4',
          params: ['0xabc123', '{"domain":{"chainId":1337},"types":{}}'],
        },
      },
    });

    expect(signature).toBe('0x' + '24'.repeat(65));
    expect(switchAttempts).toBe(2);
  });

  it('fails clearly when signing chain is missing and rpc url is not configured', async () => {
    const request = vi.fn().mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'wallet_requestPermissions') {
        return [{ parentCapability: 'eth_accounts' }];
      }
      if (method === 'eth_requestAccounts') {
        return ['0xabc123'];
      }
      if (method === 'eth_chainId') {
        return '0x66eee';
      }
      if (method === 'wallet_switchEthereumChain') {
        throw Object.assign(new Error('Unrecognized chain ID "0x539".'), { code: 4902 });
      }
      return [];
    });

    setRuntimeWindow({
      ethereum: {
        providers: [{ request, isMetaMask: true }],
      },
    });

    await connectRuntimeSlot('slot-g', 'metaMaskInjected');

    await expect(
      signRuntimeSlotActionPayload({
        slotId: 'slot-g',
        accountId: '0xabc123',
        payload: {
          id: 'uap_hl_typed_4',
          accountId: '0xabc123',
          venue: 'hyperliquid',
          kind: 'perp_order_action',
          action: {
            action: {
              type: 'order',
            },
            nonce: 1733000000003,
          },
          walletRequest: {
            method: 'eth_signTypedData_v4',
            params: ['0xabc123', '{"domain":{"chainId":1337},"types":{}}'],
          },
        },
      }),
    ).rejects.toThrow(
      'Wallet does not have chain 1337 (0x539) configured. Set NEXT_PUBLIC_HYPERLIQUID_SIGNING_CHAIN_RPC_URL and retry.',
    );
  });

  it('extracts action hash from object wallet responses', async () => {
    const request = vi.fn().mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'wallet_requestPermissions') {
        return [{ parentCapability: 'eth_accounts' }];
      }
      if (method === 'eth_requestAccounts') {
        return ['0xabc123'];
      }
      if (method === 'wallet_perp_submitAction') {
        return { txHash: '0xobjecthash' };
      }
      return [];
    });

    setRuntimeWindow({
      ethereum: {
        providers: [{ request, isMetaMask: true }],
      },
    });

    await connectRuntimeSlot('slot-h', 'metaMaskInjected');

    const actionHash = await signAndSubmitRuntimeSlotAction({
      slotId: 'slot-h',
      accountId: '0xabc123',
      payload: {
        id: 'uap_2',
        accountId: '0xabc123',
        venue: 'hyperliquid',
        kind: 'perp_order_action',
        action: {
          instrument: 'ETH-PERP',
        },
        walletRequest: {
          method: 'wallet_perp_submitAction',
          params: [{ payloadId: 'uap_2' }],
        },
      },
    });

    expect(actionHash).toBe('0xobjecthash');
  });

  it('fails when wallet submission response does not include an action hash', async () => {
    const request = vi.fn().mockImplementation(async ({ method }: { method: string }) => {
      if (method === 'wallet_requestPermissions') {
        return [{ parentCapability: 'eth_accounts' }];
      }
      if (method === 'eth_requestAccounts') {
        return ['0xabc123'];
      }
      if (method === 'wallet_perp_submitAction') {
        return {};
      }
      return [];
    });

    setRuntimeWindow({
      ethereum: {
        providers: [{ request, isMetaMask: true }],
      },
    });

    await connectRuntimeSlot('slot-i', 'metaMaskInjected');

    await expect(
      signAndSubmitRuntimeSlotAction({
        slotId: 'slot-i',
        accountId: '0xabc123',
        payload: {
          id: 'uap_3',
          accountId: '0xabc123',
          venue: 'hyperliquid',
          kind: 'perp_order_action',
          action: {
            instrument: 'SOL-PERP',
          },
          walletRequest: {
            method: 'wallet_perp_submitAction',
            params: [{ payloadId: 'uap_3' }],
          },
        },
      }),
    ).rejects.toThrow('Wallet submission did not return an action hash.');
  });

  it('propagates provider lifecycle events to slot account watchers', async () => {
    const provider = createEventfulProvider(async ({ method }: { method: string }) => {
      if (method === 'wallet_requestPermissions') {
        return [{ parentCapability: 'eth_accounts' }];
      }
      if (method === 'eth_requestAccounts') {
        return ['0xabc123'];
      }
      if (method === 'eth_accounts') {
        return ['0xabc123'];
      }

      return [];
    });
    setRuntimeWindow({
      ethereum: {
        providers: [provider],
      },
    });

    await connectRuntimeSlot('slot-a', 'metaMaskInjected');

    const snapshots: Array<{ isConnected: boolean; accountId?: string }> = [];
    const unwatch = watchRuntimeSlotAccount('slot-a', (account) => {
      snapshots.push({
        isConnected: account.isConnected,
        accountId: account.accountId,
      });
    });

    provider.emit('accountsChanged', ['0xdef456']);
    provider.emit('disconnect');

    expect(snapshots[0]).toEqual({
      isConnected: true,
      accountId: '0xabc123',
    });
    expect(snapshots[1]).toEqual({
      isConnected: true,
      accountId: '0xdef456',
    });
    expect(snapshots[2]).toEqual({
      isConnected: false,
      accountId: undefined,
    });

    unwatch();
    provider.emit('accountsChanged', ['0x123999']);
    expect(snapshots).toHaveLength(3);
    expect(provider.removeListener).toHaveBeenCalled();
  });
});
