import type { TargetChainConfig } from './types';

export const HYPERLIQUID_TARGET_CHAIN: TargetChainConfig = {
  name: 'HyperEVM',
  chainId: 999,
  chainIdHex: '0x3e7',
  rpcUrl: 'https://rpc.hyperliquid.xyz/evm',
};

export const HYPERLIQUID_TARGET_NOTE =
  'Hyperliquid trading is not active yet. This shell only verifies the wallet and chain context.';
