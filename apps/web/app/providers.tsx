'use client';

import type { ReactNode } from 'react';

import { WalletAppProviders } from '@/lib/wallet/providers';

export default function Providers({ children }: { children: ReactNode }) {
  return <WalletAppProviders>{children}</WalletAppProviders>;
}
