import { QueryClient } from '@tanstack/react-query';
import { createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { supportedChains } from './chains';
import { WALLETCONNECT_PROJECT_ID } from './config';

const connectors = [
  injected(),
  ...(WALLETCONNECT_PROJECT_ID
    ? [
        walletConnect({
          projectId: WALLETCONNECT_PROJECT_ID,
          showQrModal: true,
        }),
      ]
    : []),
];

const transports = Object.fromEntries(
  supportedChains.map((chain) => [chain.id, http(chain.rpcUrls.default.http[0])]),
) as Record<number, ReturnType<typeof http>>;

export const queryClient = new QueryClient();

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors,
  multiInjectedProviderDiscovery: true,
  ssr: true,
  transports,
});
