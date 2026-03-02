'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getWalletChainLabel } from '@/lib/wallet/chains';
import type { WalletConnectorId, WalletSlotStatus } from '@/lib/wallet/types';
import { useWalletManager } from '@/lib/wallet/wallet-manager-context';

function truncateAddress(address: string): string {
  if (address.length <= 10) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getStatusLabel(status: WalletSlotStatus): string {
  if (status === 'connected') {
    return 'Connected';
  }

  if (status === 'disconnected') {
    return 'Disconnected';
  }

  return 'Stale';
}

function getUnavailableConnectorHint(
  reason: 'connector-in-use' | 'connector-disabled' | undefined,
): string {
  if (reason === 'connector-in-use') {
    return 'In Use';
  }

  if (reason === 'connector-disabled') {
    return 'Disabled';
  }

  return '';
}

export function WalletConnectButton() {
  const {
    activeSlot,
    activeSlotId,
    canAddWallet,
    clearAllSlots,
    connectNewSlot,
    disconnectSlot,
    getConnectorOptions,
    hasHydrated,
    reconnectSlot,
    removeSlot,
    setActiveSlot,
    slots,
  } = useWalletManager();

  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<WalletConnectorId>('injected');

  const rootRef = useRef<HTMLDivElement>(null);

  const connectorOptions = getConnectorOptions();

  const hasAnyPendingAction = pendingAction !== null;
  const selectedConnectorOption = connectorOptions.find(
    (option) => option.id === selectedConnector,
  );

  const walletSummaryLabel = useMemo(() => {
    if (!activeSlot) {
      return 'No active wallet';
    }

    return `${truncateAddress(activeSlot.address)} · ${getWalletChainLabel(activeSlot.chainId)}`;
  }, [activeSlot]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleDocumentClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (selectedConnectorOption?.available) {
      return;
    }

    const firstAvailableConnector = connectorOptions.find((option) => option.available);

    if (firstAvailableConnector) {
      setSelectedConnector(firstAvailableConnector.id);
    }
  }, [connectorOptions, selectedConnectorOption?.available]);

  async function runAsyncAction(actionId: string, action: () => Promise<void>) {
    if (hasAnyPendingAction) {
      return;
    }

    setPendingAction(actionId);

    try {
      await action();
    } finally {
      setPendingAction(null);
    }
  }

  function isActionPending(actionId: string): boolean {
    return pendingAction === actionId;
  }

  async function handleConnectWallet() {
    await runAsyncAction('connect', async () => {
      await connectNewSlot(selectedConnector);
    });
  }

  async function handleReconnectWallet(slotId: string) {
    await runAsyncAction(`reconnect-${slotId}`, async () => {
      await reconnectSlot(slotId);
    });
  }

  async function handleDisconnectWallet(slotId: string) {
    await runAsyncAction(`disconnect-${slotId}`, async () => {
      await disconnectSlot(slotId);
    });
  }

  function handleRemoveWallet(slotId: string) {
    removeSlot(slotId);
  }

  function handleSwitchWallet(slotId: string) {
    setActiveSlot(slotId);
  }

  function handleClearAllSlots() {
    clearAllSlots();
  }

  return (
    <div className="wallet-dropdown" ref={rootRef}>
      <Button
        type="button"
        variant="soft"
        className="wallet-dropdown-trigger"
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        disabled={!isMounted || !hasHydrated}
      >
        <span className="wallet-summary" aria-live="polite">
          <span className="wallet-summary-address">{walletSummaryLabel}</span>
          <span className="wallet-summary-count">{`${slots.length}/3`}</span>
        </span>
      </Button>

      {isOpen ? (
        <div className="wallet-dropdown-panel" role="menu" aria-label="Wallet manager">
          <div className="wallet-slot-list">
            {slots.length === 0 ? (
              <p className="wallet-empty">No wallets connected.</p>
            ) : (
              slots.map((slot) => (
                <div key={slot.id} className="wallet-slot-row">
                  <div className="wallet-slot-meta">
                    <p className="wallet-slot-address">{truncateAddress(slot.address)}</p>
                    <p className="wallet-slot-chain">{getWalletChainLabel(slot.chainId)}</p>
                    <span className={`wallet-slot-status wallet-slot-status-${slot.status}`}>
                      {getStatusLabel(slot.status)}
                    </span>
                    {activeSlotId === slot.id ? (
                      <span className="wallet-slot-active">Active</span>
                    ) : null}
                  </div>
                  <div className="wallet-slot-actions">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSwitchWallet(slot.id)}
                      disabled={hasAnyPendingAction || activeSlotId === slot.id}
                    >
                      Switch
                    </Button>
                    {slot.status === 'connected' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleDisconnectWallet(slot.id)}
                        disabled={hasAnyPendingAction}
                      >
                        {isActionPending(`disconnect-${slot.id}`)
                          ? 'Disconnecting...'
                          : 'Disconnect'}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleReconnectWallet(slot.id)}
                        disabled={hasAnyPendingAction}
                      >
                        {isActionPending(`reconnect-${slot.id}`) ? 'Reconnecting...' : 'Reconnect'}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRemoveWallet(slot.id)}
                      disabled={hasAnyPendingAction}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="wallet-connect-controls">
            <label htmlFor="wallet-connector-select" className="wallet-connector-label">
              Connector
            </label>
            <select
              id="wallet-connector-select"
              className="wallet-connector-select"
              value={selectedConnector}
              onChange={(event) => setSelectedConnector(event.target.value as WalletConnectorId)}
              disabled={hasAnyPendingAction}
            >
              {connectorOptions.map((option) => (
                <option key={option.id} value={option.id} disabled={!option.available}>
                  {option.label}
                  {option.available
                    ? ''
                    : ` (${getUnavailableConnectorHint(option.unavailableReason)})`}
                </option>
              ))}
            </select>
            <div className="wallet-connect-actions">
              <Button
                type="button"
                size="sm"
                onClick={() => void handleConnectWallet()}
                disabled={
                  !canAddWallet ||
                  hasAnyPendingAction ||
                  !selectedConnectorOption ||
                  !selectedConnectorOption.available
                }
              >
                {isActionPending('connect') ? 'Connecting...' : 'Add Wallet'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleClearAllSlots}
                disabled={slots.length === 0 || hasAnyPendingAction}
              >
                Clear All
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
