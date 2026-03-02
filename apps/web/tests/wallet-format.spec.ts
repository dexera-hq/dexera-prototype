import { describe, expect, it } from 'vitest';
import { getInjectedProvider } from '../app/_lib/wallet/eip1193';
import {
  formatChainLabel,
  getChainName,
  hexChainIdToDecimal,
  matchesTargetChain,
  shortenAddress,
} from '../app/_lib/wallet/format';
import { HYPERLIQUID_TARGET_CHAIN } from '../app/_lib/wallet/hyperliquid';
import type { TargetChainConfig } from '../app/_lib/wallet/types';

describe('wallet formatting helpers', () => {
  it('shortens addresses for terminal display', () => {
    expect(shortenAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234...5678');
  });

  it('converts and formats chain identifiers', () => {
    const chainIdDecimal = hexChainIdToDecimal('0x3e7');

    expect(chainIdDecimal).toBe(999);
    expect(getChainName(chainIdDecimal)).toBe('HyperEVM');
    expect(formatChainLabel('HyperEVM', '0x3e7', chainIdDecimal)).toBe('HyperEVM (0x3e7 / 999)');
  });

  it('matches target chains and tolerates an unset target config', () => {
    const placeholderTarget: TargetChainConfig = { name: 'Pending' };

    expect(matchesTargetChain('0x3e7', HYPERLIQUID_TARGET_CHAIN)).toBe(true);
    expect(matchesTargetChain('0x1', HYPERLIQUID_TARGET_CHAIN)).toBe(false);
    expect(matchesTargetChain('0x1', placeholderTarget)).toBeNull();
  });

  it('returns null provider detection during server rendering', () => {
    expect(getInjectedProvider()).toBeNull();
  });
});
