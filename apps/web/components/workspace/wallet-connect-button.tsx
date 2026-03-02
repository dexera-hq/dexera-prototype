'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useWalletManager } from '@/lib/wallet/wallet-manager-context';

function truncateAddress(address: string): string {
  if (address.length <= 10) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletConnectButton() {
  const { activeSlot, slots, connectWallet } = useWalletManager();
  const buttonLabel = activeSlot ? `Wallet ${truncateAddress(activeSlot.address)}` : 'Connect Wallet';
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  function handleConnectWallet() {
    connectWallet();
  }

  return (
    <Button type="button" onClick={handleConnectWallet} disabled={!isMounted}>
      {buttonLabel}
      {slots.length > 0 ? ` (${slots.length}/3)` : null}
    </Button>
  );
}
