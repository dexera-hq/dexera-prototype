import { afterEach, describe, expect, it } from 'vitest';
import { normalizeWalletConnectProjectId } from '../app/_lib/wallet/config';
import {
  chainIdToHex,
  formatChainLabel,
  getChainName,
  matchesTargetChain,
  shortenAddress,
} from '../app/_lib/wallet/format';
import { HYPERLIQUID_TARGET_CHAIN } from '../app/_lib/wallet/hyperliquid';
import { isManuallyDisconnected, setManualDisconnect } from '../app/_lib/wallet/storage';

describe('wallet formatting helpers', () => {
  it('shortens addresses for terminal display', () => {
    expect(shortenAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234...5678');
  });

  it('converts and formats numeric chain identifiers', () => {
    expect(chainIdToHex(999)).toBe('0x3e7');
    expect(getChainName(999)).toBe('HyperEVM');
    expect(formatChainLabel('HyperEVM', 999)).toBe('HyperEVM (0x3e7 / 999)');
  });

  it('matches target chains and tolerates a missing chain id', () => {
    expect(matchesTargetChain(999, HYPERLIQUID_TARGET_CHAIN.chainId)).toBe(true);
    expect(matchesTargetChain(1, HYPERLIQUID_TARGET_CHAIN.chainId)).toBe(false);
    expect(matchesTargetChain(null, HYPERLIQUID_TARGET_CHAIN.chainId)).toBeNull();
  });

  it('normalizes the WalletConnect project id', () => {
    expect(normalizeWalletConnectProjectId(undefined)).toBeNull();
    expect(normalizeWalletConnectProjectId('   ')).toBeNull();
    expect(normalizeWalletConnectProjectId(' demo-project-id ')).toBe('demo-project-id');
  });
});

describe('manual disconnect storage', () => {
  const originalWindow = globalThis.window;
  const store = new Map<string, string>();

  function installMockWindow() {
    const mockWindow = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    } as Window & typeof globalThis;

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: mockWindow,
      writable: true,
    });
  }

  afterEach(() => {
    store.clear();

    if (originalWindow === undefined) {
      delete (globalThis as { window?: Window }).window;
      return;
    }

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
      writable: true,
    });
  });

  it('persists and clears the manual disconnect flag', () => {
    installMockWindow();

    expect(isManuallyDisconnected()).toBe(false);

    setManualDisconnect(true);
    expect(isManuallyDisconnected()).toBe(true);

    setManualDisconnect(false);
    expect(isManuallyDisconnected()).toBe(false);
  });
});
