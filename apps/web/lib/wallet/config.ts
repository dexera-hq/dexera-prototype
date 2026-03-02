import { injected } from 'wagmi/connectors';
import { http, createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';

import { HYPER_EVM_RPC_URL, hyperEvmChain, walletChains } from './chains';
const connectors = [injected()];

export const walletConfig = createConfig({
  chains: walletChains,
  connectors,
  transports: {
    [mainnet.id]: http(),
    [hyperEvmChain.id]: http(HYPER_EVM_RPC_URL),
  },
  ssr: true,
});
