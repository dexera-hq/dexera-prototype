import { defineChain } from 'viem';
import { arbitrum, base, mainnet, optimism, polygon, sepolia } from 'wagmi/chains';
import { HYPERLIQUID_TARGET_CHAIN } from './hyperliquid';

export const hyperEvmChain = defineChain({
  id: HYPERLIQUID_TARGET_CHAIN.chainId,
  name: HYPERLIQUID_TARGET_CHAIN.name,
  nativeCurrency: {
    decimals: 18,
    name: 'HYPE',
    symbol: 'HYPE',
  },
  rpcUrls: {
    default: {
      http: [HYPERLIQUID_TARGET_CHAIN.rpcUrl],
    },
    public: {
      http: [HYPERLIQUID_TARGET_CHAIN.rpcUrl],
    },
  },
  testnet: false,
});

export const supportedChains = [
  mainnet,
  optimism,
  polygon,
  base,
  arbitrum,
  sepolia,
  hyperEvmChain,
] as const;
