import type { HexChainId, TargetChainConfig } from './types';

const KNOWN_CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet',
  10: 'Optimism',
  137: 'Polygon PoS',
  999: 'HyperEVM',
  8453: 'Base',
  42161: 'Arbitrum One',
  11155111: 'Sepolia',
};

export function shortenAddress(address: string | null, visibleCharacters = 4): string {
  if (!address) {
    return 'Not connected';
  }

  const prefixLength = Math.max(visibleCharacters + 2, 6);

  if (address.length <= prefixLength + visibleCharacters) {
    return address;
  }

  return `${address.slice(0, prefixLength)}...${address.slice(-visibleCharacters)}`;
}

export function hexChainIdToDecimal(chainIdHex: HexChainId | null): number | null {
  if (!chainIdHex) {
    return null;
  }

  const parsed = Number.parseInt(chainIdHex, 16);
  return Number.isNaN(parsed) ? null : parsed;
}

export function getChainName(chainIdDecimal: number | null): string | null {
  if (chainIdDecimal == null) {
    return null;
  }

  return KNOWN_CHAIN_NAMES[chainIdDecimal] ?? 'Unknown EVM Chain';
}

export function matchesTargetChain(
  chainIdHex: HexChainId | null,
  targetChain: TargetChainConfig,
): boolean | null {
  if (!chainIdHex) {
    return null;
  }

  if (targetChain.chainIdHex) {
    return chainIdHex.toLowerCase() === targetChain.chainIdHex.toLowerCase();
  }

  if (targetChain.chainIdDecimal != null) {
    return hexChainIdToDecimal(chainIdHex) === targetChain.chainIdDecimal;
  }

  return null;
}

export function formatChainLabel(
  chainName: string | null,
  chainIdHex: HexChainId | null,
  chainIdDecimal: number | null,
): string {
  if (!chainIdHex || chainIdDecimal == null) {
    return 'Unavailable';
  }

  const resolvedName = chainName ?? 'Unknown EVM Chain';
  return `${resolvedName} (${chainIdHex} / ${chainIdDecimal})`;
}
