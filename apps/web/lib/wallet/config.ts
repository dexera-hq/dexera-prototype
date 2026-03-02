import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import type { Chain } from 'viem';
import { mainnet } from 'wagmi/chains';

import { hyperEvmChainDefinition } from './chains';

// WalletConnect-capable connectors need a real project ID in production.
export const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? 'DUMMY_WALLETCONNECT_PROJECT_ID';

export const hyperEvmChain = hyperEvmChainDefinition as Chain;
export const walletChains = [mainnet, hyperEvmChain];

export const walletConfig = getDefaultConfig({
  appName: 'Dexera Terminal',
  projectId: walletConnectProjectId,
  chains: walletChains,
  ssr: true,
});
