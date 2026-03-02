import { numberToHex } from 'viem';
import type { HexChainId } from './types';

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

export function chainIdToHex(chainId: number | null): HexChainId | null {
  if (chainId == null) {
    return null;
  }

  return numberToHex(chainId) as HexChainId;
}

export function getChainName(chainId: number | null): string | null {
  if (chainId == null) {
    return null;
  }

  return KNOWN_CHAIN_NAMES[chainId] ?? 'Unknown EVM Chain';
}

export function matchesTargetChain(chainId: number | null, targetChainId: number): boolean | null {
  if (chainId == null) {
    return null;
  }

  return chainId === targetChainId;
}

export function formatChainLabel(chainName: string | null, chainId: number | null): string {
  if (chainId == null) {
    return 'Unavailable';
  }

  const chainIdHex = chainIdToHex(chainId);

  if (!chainIdHex) {
    return 'Unavailable';
  }

  const resolvedName = chainName ?? 'Unknown EVM Chain';
  return `${resolvedName} (${chainIdHex} / ${chainId})`;
}
