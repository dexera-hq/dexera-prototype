import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import { injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import type { Chain } from 'viem';
import { http, createConfig } from 'wagmi';
import { mainnet } from 'wagmi/chains';

import { HYPER_EVM_RPC_URL, hyperEvmChainDefinition } from './chains';

export const hyperEvmChain = hyperEvmChainDefinition as Chain;
export const walletChains = [mainnet, hyperEvmChain] as const;
export const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'DUMMY_WALLETCONNECT_PROJECT_ID';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [
        injectedWallet,
      ],
    },
  ],
  {
    appName: 'Dexera Terminal',
    projectId: walletConnectProjectId,
  },
);

export const walletConfig = createConfig({
  chains: walletChains,
  connectors,
  transports: {
    [mainnet.id]: http(),
    [hyperEvmChain.id]: http(HYPER_EVM_RPC_URL),
  },
  ssr: true,
});
