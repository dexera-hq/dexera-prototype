'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { WalletManagerProvider } from './wallet-manager-context';

export function WalletAppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <WalletManagerProvider>{children}</WalletManagerProvider>
    </QueryClientProvider>
  );
}
