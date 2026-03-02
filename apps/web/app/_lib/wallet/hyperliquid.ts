import type { TargetChainConfig } from './types';

export const HYPERLIQUID_TARGET_CHAIN: TargetChainConfig = {
  name: 'HyperEVM',
  chainIdHex: '0x3e7',
  chainIdDecimal: 999,
};

export const HYPERLIQUID_TARGET_NOTE =
  'Hyperliquid trading is not active yet. This shell only verifies the wallet and chain context.';
