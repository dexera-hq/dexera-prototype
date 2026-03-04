'use client';

import type { VenueId } from '@dexera/shared-types';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { SUPPORTED_VENUES, getWalletVenueLabel } from '@/lib/wallet/chains';
import {
  isWalletSlotTradable,
  type ConnectWalletReason,
  type WalletConnectorId,
  type WalletSlot,
  type WalletSlotStatus,
} from '@/lib/wallet/types';
import { useWalletManager } from '@/lib/wallet/wallet-manager-context';

function truncateAccountId(accountId: string): string {
  if (accountId.length <= 14) {
    return accountId;
  }

  return `${accountId.slice(0, 8)}...${accountId.slice(-4)}`;
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

function getEligibilityLabel(slot: WalletSlot): string {
  if (slot.status !== 'connected') {
    return 'Offline';
  }

  if (slot.ownershipStatus === 'failed') {
    return 'Verification Failed';
  }

  if (slot.eligibilityStatus === 'checking') {
    return 'Checking Eligibility';
  }

  if (isWalletSlotTradable(slot)) {
    return 'Tradable';
  }

  if (slot.eligibilityStatus === 'not-eligible') {
    return 'Connected, Not Eligible';
  }

  if (slot.eligibilityStatus === 'error') {
    return 'Verification Error';
  }

  return 'Connected, Unverified';
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

function getConnectFailureMessage(reason: ConnectWalletReason): string {
  if (reason === 'connector-missing') {
    return 'No wallet provider was detected for this connector.';
  }

  if (reason === 'connector-in-use') {
    return 'This connector is already in use by another connected slot.';
  }

  if (reason === 'verification-failed') {
    return 'Wallet connected, but signature verification failed.';
  }

  if (reason === 'failed') {
    return 'Wallet connection was canceled or rejected.';
  }

  return 'Unable to connect wallet right now.';
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
  const [selectedConnector, setSelectedConnector] = useState<WalletConnectorId>('metaMaskInjected');
  const [selectedVenue, setSelectedVenue] = useState<VenueId>('hyperliquid');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

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

    const tradableTag = isWalletSlotTradable(activeSlot) ? 'Tradable' : 'Restricted';
    return `${truncateAccountId(activeSlot.accountId)} · ${getWalletVenueLabel(activeSlot.venue)} · ${tradableTag}`;
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
      const result = await connectNewSlot(selectedConnector, selectedVenue);

      if (!result.connected) {
        setActionMessage(getConnectFailureMessage(result.reason));
        return;
      }

      setActionMessage(
        'Wallet connected. Complete signature verification to unlock tradable status for this venue.',
      );
    });
  }

  async function handleReconnectWallet(slotId: string) {
    await runAsyncAction(`reconnect-${slotId}`, async () => {
      const result = await reconnectSlot(slotId);

      if (!result.connected) {
        setActionMessage(getConnectFailureMessage(result.reason));
        return;
      }

      setActionMessage('Wallet reconnected. Verification state was refreshed.');
    });
  }

  async function handleDisconnectWallet(slotId: string) {
    await runAsyncAction(`disconnect-${slotId}`, async () => {
      await disconnectSlot(slotId);
      setActionMessage(null);
    });
  }

  function handleRemoveWallet(slotId: string) {
    removeSlot(slotId);
    setActionMessage(null);
  }

  function handleSwitchWallet(slotId: string) {
    setActiveSlot(slotId);
  }

  function handleClearAllSlots() {
    clearAllSlots();
    setActionMessage(null);
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
                    <p className="wallet-slot-address">{truncateAccountId(slot.accountId)}</p>
                    <p className="wallet-slot-chain">{getWalletVenueLabel(slot.venue)}</p>
                    <span className={`wallet-slot-status wallet-slot-status-${slot.status}`}>
                      {getStatusLabel(slot.status)}
                    </span>
                    <span className="wallet-slot-status">{getEligibilityLabel(slot)}</span>
                    {activeSlotId === slot.id ? (
                      <span className="wallet-slot-active">Active</span>
                    ) : null}
                    {slot.eligibilityReason ? (
                      <p className="wallet-connect-feedback">{slot.eligibilityReason}</p>
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

            <label htmlFor="wallet-venue-select" className="wallet-connector-label">
              Venue
            </label>
            <select
              id="wallet-venue-select"
              className="wallet-connector-select"
              value={selectedVenue}
              onChange={(event) => setSelectedVenue(event.target.value as VenueId)}
              disabled={hasAnyPendingAction}
            >
              {SUPPORTED_VENUES.map((venue) => (
                <option key={venue} value={venue}>
                  {getWalletVenueLabel(venue)}
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
            {actionMessage ? (
              <p className="wallet-connect-feedback" role="status" aria-live="polite">
                {actionMessage}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
