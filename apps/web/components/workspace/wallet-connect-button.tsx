'use client';

import type { VenueId } from '@dexera/shared-types';
import { Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
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

function getStatusBadgeVariant(status: WalletSlotStatus): 'secondary' | 'outline' | 'warning' {
  if (status === 'connected') {
    return 'secondary';
  }

  if (status === 'stale') {
    return 'warning';
  }

  return 'outline';
}

function getEligibilityBadgeVariant(
  slot: WalletSlot,
): 'success' | 'warning' | 'outline' | 'destructive' {
  if (isWalletSlotTradable(slot)) {
    return 'success';
  }

  if (slot.ownershipStatus === 'failed' || slot.eligibilityStatus === 'error') {
    return 'destructive';
  }

  if (slot.eligibilityStatus === 'checking') {
    return 'warning';
  }

  return 'outline';
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
    setActionMessage(null);
  }

  function handleClearAllSlots() {
    clearAllSlots();
    setActionMessage(null);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setIsOpen(true)}
        disabled={!isMounted || !hasHydrated}
        className="max-w-full justify-start gap-3 sm:min-w-[280px]"
      >
        <Wallet className="size-4" />
        <span className="truncate text-left">{walletSummaryLabel}</span>
        <Badge variant="secondary" className="ml-auto hidden sm:inline-flex">
          {slots.length}/3
        </Badge>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle>Wallet Sessions</DialogTitle>
            <DialogDescription>
              Connect, verify, switch, and manage venue-specific wallet slots without leaving the
              workspace.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-0 lg:grid-cols-[1.45fr_0.95fr]">
            <div className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Connected Slots</p>
                  <p className="text-sm text-muted-foreground">
                    Up to three wallet sessions can stay active at once.
                  </p>
                </div>
                <Badge variant="outline" className="border-border/70 bg-background/60">
                  {slots.length} total
                </Badge>
              </div>

              <ScrollArea className="max-h-[48vh] px-6 pb-6">
                <div className="space-y-3 pr-4">
                  {slots.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/80 bg-background/40 p-4">
                      <p className="text-sm font-medium text-foreground">No wallets connected.</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Add a wallet on the right to start submitting venue actions.
                      </p>
                    </div>
                  ) : (
                    slots.map((slot) => (
                      <div
                        key={slot.id}
                        className="rounded-xl border border-border/80 bg-background/40 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">
                                {truncateAccountId(slot.accountId)}
                              </p>
                              <Badge
                                variant={getStatusBadgeVariant(slot.status)}
                                className="uppercase"
                              >
                                {getStatusLabel(slot.status)}
                              </Badge>
                              <Badge
                                variant={getEligibilityBadgeVariant(slot)}
                                className="uppercase"
                              >
                                {getEligibilityLabel(slot)}
                              </Badge>
                              {activeSlotId === slot.id ? (
                                <Badge variant="outline" className="uppercase">
                                  Active
                                </Badge>
                              ) : null}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {getWalletVenueLabel(slot.venue)}
                            </p>
                            {slot.eligibilityReason ? (
                              <p className="text-sm text-muted-foreground">
                                {slot.eligibilityReason}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
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
                                {isActionPending(`reconnect-${slot.id}`)
                                  ? 'Reconnecting...'
                                  : 'Reconnect'}
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
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="flex flex-col gap-4 px-6 py-5">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Add Wallet</p>
                <p className="text-sm text-muted-foreground">
                  Choose a connector and venue. Connected slots remain independently switchable.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Connector</label>
                <Select
                  value={selectedConnector}
                  onValueChange={(value) => setSelectedConnector(value as WalletConnectorId)}
                  disabled={hasAnyPendingAction}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select connector" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectorOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id} disabled={!option.available}>
                        {option.label}
                        {option.available
                          ? ''
                          : ` (${getUnavailableConnectorHint(option.unavailableReason)})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Venue</label>
                <Select
                  value={selectedVenue}
                  onValueChange={(value) => setSelectedVenue(value as VenueId)}
                  disabled={hasAnyPendingAction}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_VENUES.map((venue) => (
                      <SelectItem key={venue} value={venue}>
                        {getWalletVenueLabel(venue)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  type="button"
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
                  variant="secondary"
                  onClick={handleClearAllSlots}
                  disabled={slots.length === 0 || hasAnyPendingAction}
                >
                  Clear All
                </Button>
              </div>

              <Separator />

              <div className="rounded-xl border border-border/80 bg-background/40 p-4">
                <p className="text-sm font-medium text-foreground">Active session</p>
                <p className="mt-1 text-sm text-muted-foreground">{walletSummaryLabel}</p>
                {actionMessage ? (
                  <p
                    className="mt-3 text-sm text-muted-foreground"
                    role="status"
                    aria-live="polite"
                  >
                    {actionMessage}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
