'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { queryClient, wagmiConfig } from '../_lib/wallet/wagmi-config';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig} reconnectOnMount>
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  );
}
