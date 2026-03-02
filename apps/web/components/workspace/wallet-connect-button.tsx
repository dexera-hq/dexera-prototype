'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getWalletChainLabel } from '@/lib/wallet/chains';
import { useWalletManager } from '@/lib/wallet/wallet-manager-context';

function truncateAddress(address: string): string {
  if (address.length <= 10) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletConnectButton() {
  const { activeSlot, canAddWallet, connectWallet, disconnectSlot, slots } = useWalletManager();
  const [isMounted, setIsMounted] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  async function handleConnectWallet() {
    if (isConnecting) {
      return;
    }

    setIsConnecting(true);

    try {
      await connectWallet();
    } finally {
      setIsConnecting(false);
    }
  }

  function handleDisconnectWallet() {
    if (!activeSlot) {
      return;
    }

    disconnectSlot(activeSlot.id);
  }

  if (!activeSlot) {
    return (
      <Button type="button" onClick={handleConnectWallet} disabled={!isMounted || isConnecting}>
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </Button>
    );
  }

  return (
    <div className="wallet-controls">
      <div className="wallet-summary" aria-live="polite">
        <span className="wallet-summary-address">{truncateAddress(activeSlot.address)}</span>
        <span className="wallet-summary-chain">{getWalletChainLabel(activeSlot.chainId)}</span>
        <span className="wallet-summary-count">{`${slots.length}/3`}</span>
      </div>
      <Button
        type="button"
        variant="soft"
        onClick={handleConnectWallet}
        disabled={!isMounted || isConnecting || !canAddWallet}
      >
        {isConnecting ? 'Connecting...' : 'Add Wallet'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleDisconnectWallet}
        disabled={isConnecting}
      >
        Disconnect
      </Button>
    </div>
  );
}
