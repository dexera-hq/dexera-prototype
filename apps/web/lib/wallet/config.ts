import { createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

import { HYPER_EVM_RPC_URL, hyperEvmChain, walletChains } from './chains';

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? '';

export function isWalletConnectConfigured(): boolean {
  return walletConnectProjectId.length > 0;
}

const connectors = [
  injected(),
  coinbaseWallet({ appName: 'Dexera Prototype' }),
  ...(isWalletConnectConfigured()
    ? [
        walletConnect({
          projectId: walletConnectProjectId,
          showQrModal: true,
        }),
      ]
    : []),
];

export const walletConfig = createConfig({
  chains: walletChains,
  connectors,
  transports: {
    [mainnet.id]: http(),
    [hyperEvmChain.id]: http(HYPER_EVM_RPC_URL),
  },
  ssr: true,
});
