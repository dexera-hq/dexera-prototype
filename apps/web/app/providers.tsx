'use client';

import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const WalletAppProviders = dynamic(
  () => import('@/lib/wallet/providers').then((module) => module.WalletAppProviders),
  {
    ssr: false,
  },
);

export default function Providers({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <>{children}</>;
  }

  return <WalletAppProviders>{children}</WalletAppProviders>;
}
