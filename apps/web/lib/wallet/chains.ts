export const HYPER_EVM_CHAIN_ID = 999;
export const HYPER_EVM_RPC_URL = 'https://rpc.hyperliquid.xyz/evm';
export const HYPER_EVM_EXPLORER_URL = 'https://hyperevmscan.io';

export const hyperEvmChainDefinition = {
  id: HYPER_EVM_CHAIN_ID,
  name: 'HyperEVM',
  nativeCurrency: {
    name: 'Hyperliquid',
    symbol: 'HYPE',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [HYPER_EVM_RPC_URL],
    },
    public: {
      http: [HYPER_EVM_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: 'HyperEVM Explorer',
      url: HYPER_EVM_EXPLORER_URL,
    },
  },
  testnet: false,
} as const;
