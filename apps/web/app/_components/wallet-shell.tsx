'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Compass, Link2, ShieldCheck, Wallet2 } from 'lucide-react';
import {
  useAccount,
  useChainId,
  useConnect,
  useConnectors,
  useDisconnect,
  useSwitchChain,
} from 'wagmi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  INJECTED_CONNECTOR_ID,
  isWalletConnectConfigured,
  WALLETCONNECT_CONNECTOR_ID,
} from '../_lib/wallet/config';
import {
  chainIdToHex,
  formatChainLabel,
  getChainName,
  matchesTargetChain,
  shortenAddress,
} from '../_lib/wallet/format';
import { HYPERLIQUID_TARGET_CHAIN, HYPERLIQUID_TARGET_NOTE } from '../_lib/wallet/hyperliquid';
import { isManuallyDisconnected, setManualDisconnect } from '../_lib/wallet/storage';
import type { WalletConnectorId, WalletStatus, WalletUiState } from '../_lib/wallet/types';

function getStatusLabel(status: WalletStatus): string {
  switch (status) {
    case 'unsupported':
      return 'No Connector';
    case 'disconnected':
      return 'Idle';
    case 'connecting':
      return 'Handshake';
    case 'connected':
      return 'Live';
    case 'error':
      return 'Attention';
    default:
      return 'Unknown';
  }
}

function getStatusToneClass(status: WalletStatus): string {
  switch (status) {
    case 'connected':
      return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100';
    case 'connecting':
      return 'border-amber-300/30 bg-amber-300/10 text-amber-100';
    case 'error':
    case 'unsupported':
      return 'border-rose-300/30 bg-rose-300/10 text-rose-100';
    default:
      return 'border-border bg-background/45 text-muted-foreground';
  }
}

function normalizeWalletError(error: unknown, fallbackMessage: string): string | null {
  if (!error) {
    return null;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (error && typeof error === 'object') {
    const walletError = error as { message?: unknown; shortMessage?: unknown };

    if (
      typeof walletError.shortMessage === 'string' &&
      walletError.shortMessage.trim().length > 0
    ) {
      return walletError.shortMessage;
    }

    if (typeof walletError.message === 'string' && walletError.message.trim().length > 0) {
      return walletError.message;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

function isInjectedProviderAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const walletWindow = window as Window & { ethereum?: unknown };
  return walletWindow.ethereum != null;
}

function getConnectorCopy(state: WalletUiState, isInjectedAvailable: boolean): string {
  if (!state.connectorReady) {
    return isWalletConnectConfigured
      ? 'Browser wallet not detected. Use WalletConnect to connect from inside Dexera.'
      : 'Install an injected wallet or configure WalletConnect to connect from Dexera.';
  }

  switch (state.status) {
    case 'disconnected':
      return isInjectedAvailable
        ? 'Connect with an injected wallet or WalletConnect to expose account and chain context.'
        : 'Use WalletConnect to connect from inside Dexera.';
    case 'connecting':
      return 'Waiting for the wallet connector to confirm account access.';
    case 'connected':
      return state.connectorName
        ? `Connected through ${state.connectorName} with wagmi and viem.`
        : 'Connected through wagmi and viem.';
    case 'error':
      return 'Dexera could not complete the wallet action. Review the error and retry.';
    default:
      return 'Wallet connectors are ready for a connection request.';
  }
}

function getTargetCopy(state: WalletUiState): string {
  if (state.isTargetChain === true) {
    return 'Aligned with the Hyperliquid execution target.';
  }

  if (state.isTargetChain === false) {
    return 'Select HyperEVM before Hyperliquid trading goes live.';
  }

  return HYPERLIQUID_TARGET_NOTE;
}

function getConnectorById<T extends { id: string }>(
  connectors: readonly T[],
  connectorId: WalletConnectorId,
): T | undefined {
  return connectors.find((connector) => connector.id === connectorId);
}

export function WalletShell() {
  const [hasInjectedProvider, setHasInjectedProvider] = useState(false);
  const [lastSeenChainId, setLastSeenChainId] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingConnectorId, setPendingConnectorId] = useState<WalletConnectorId | null>(null);
  const account = useAccount();
  const currentChainId = useChainId();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();

  const injectedConnector = getConnectorById(connectors, INJECTED_CONNECTOR_ID);
  const walletConnectConnector = getConnectorById(connectors, WALLETCONNECT_CONNECTOR_ID);

  useEffect(() => {
    setHasInjectedProvider(isInjectedProviderAvailable());
  }, []);

  useEffect(() => {
    if (account.status === 'connected') {
      setLastSeenChainId(currentChainId);
      setActionMessage(null);
      setPendingConnectorId(null);
    }
  }, [account.status, currentChainId]);

  useEffect(() => {
    if (!isManuallyDisconnected()) {
      return;
    }

    if (account.status === 'connected' || account.status === 'reconnecting') {
      disconnect.disconnect();
    }
  }, [account.status, disconnect]);

  const activeChainId = account.status === 'connected' ? currentChainId : lastSeenChainId;
  const connectorReady =
    (hasInjectedProvider && injectedConnector != null) || walletConnectConnector != null;
  const errorMessage =
    actionMessage ??
    normalizeWalletError(switchChain.error, 'Unable to switch to HyperEVM.') ??
    normalizeWalletError(connect.error, 'Unable to connect to the selected wallet.');

  const walletStatus: WalletStatus = useMemo(() => {
    if (account.status === 'connected') {
      return 'connected';
    }

    if (account.status === 'connecting' || account.status === 'reconnecting' || connect.isPending) {
      return 'connecting';
    }

    if (!connectorReady) {
      return 'unsupported';
    }

    if (errorMessage) {
      return 'error';
    }

    return 'disconnected';
  }, [account.status, connect.isPending, connectorReady, errorMessage]);

  const walletState = useMemo<WalletUiState>(
    () => ({
      status: walletStatus,
      connectorReady,
      address: account.address ?? null,
      chainId: activeChainId,
      chainIdHex: chainIdToHex(activeChainId),
      chainName: getChainName(activeChainId),
      connectorName: account.connector?.name ?? null,
      isTargetChain: matchesTargetChain(activeChainId, HYPERLIQUID_TARGET_CHAIN.chainId),
      errorMessage,
    }),
    [
      account.address,
      account.connector?.name,
      activeChainId,
      connectorReady,
      errorMessage,
      walletStatus,
    ],
  );

  const chainLabel = formatChainLabel(walletState.chainName, walletState.chainId);
  const targetCopy = getTargetCopy(walletState);
  const showSwitchAction =
    walletState.status === 'connected' &&
    walletState.isTargetChain === false &&
    typeof switchChain.switchChainAsync === 'function';

  const handleConnect = useCallback(
    async (connectorId: WalletConnectorId) => {
      const connector = getConnectorById(connectors, connectorId);

      if (!connector) {
        setPendingConnectorId(null);
        setActionMessage('That connector is not available in this Dexera build.');
        return;
      }

      connect.reset();
      switchChain.reset();
      setActionMessage(null);
      setPendingConnectorId(connectorId);

      try {
        await connect.connectAsync({ connector });
        setManualDisconnect(false);
        setPendingConnectorId(null);
      } catch (error) {
        setPendingConnectorId(null);
        setActionMessage(
          normalizeWalletError(error, 'Unable to connect to the selected wallet.') ??
            'Unable to connect to the selected wallet.',
        );
      }
    },
    [connect, connectors, switchChain],
  );

  const handleDisconnect = useCallback(() => {
    setManualDisconnect(true);
    connect.reset();
    switchChain.reset();
    setActionMessage(null);
    setPendingConnectorId(null);
    disconnect.disconnect();
  }, [connect, disconnect, switchChain]);

  const handleSwitchChain = useCallback(async () => {
    if (typeof switchChain.switchChainAsync !== 'function') {
      setActionMessage('This connector does not support programmatic chain switching.');
      return;
    }

    connect.reset();
    switchChain.reset();
    setActionMessage(null);
    setPendingConnectorId(null);

    try {
      await switchChain.switchChainAsync({ chainId: HYPERLIQUID_TARGET_CHAIN.chainId });
    } catch (error) {
      setActionMessage(
        normalizeWalletError(error, 'Unable to switch to HyperEVM.') ??
          'Unable to switch to HyperEVM.',
      );
    }
  }, [connect, switchChain]);

  const injectedDisabled =
    connect.isPending ||
    walletState.status === 'connected' ||
    !hasInjectedProvider ||
    !injectedConnector;
  const walletConnectDisabled =
    connect.isPending ||
    walletState.status === 'connected' ||
    !isWalletConnectConfigured ||
    !walletConnectConnector;

  return (
    <section
      id="wallet-shell"
      aria-labelledby="wallet-shell-title"
      className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-card/75 p-6 shadow-panel backdrop-blur-xl sm:p-8"
    >
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />

      <div className="relative space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <Badge variant="outline" className="w-fit">
              Wallet shell
            </Badge>
            <div className="space-y-3">
              <h2 id="wallet-shell-title" className="text-3xl sm:text-4xl">
                Connect a wallet without leaving your custody.
              </h2>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                Dexera uses wagmi and viem for non-custodial wallet connectivity. It only reads your
                public address and chain context while Hyperliquid trading remains disabled.
              </p>
            </div>
          </div>

          <Badge
            variant="outline"
            className={cn(
              'w-fit px-4 py-2 text-[0.68rem] tracking-[0.26em]',
              getStatusToneClass(walletStatus),
            )}
          >
            {getStatusLabel(walletStatus)}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border/60 bg-background/60 shadow-none">
            <CardHeader className="gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">Connectors</Badge>
                <Link2 className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-xl">
                {walletState.connectorName ??
                  (walletState.connectorReady
                    ? 'Dexera connectors ready'
                    : 'No connector available')}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <CardDescription className="leading-7">
                {getConnectorCopy(walletState, hasInjectedProvider)}
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/60 shadow-none">
            <CardHeader className="gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">Address</Badge>
                <Wallet2 className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-xl" title={walletState.address ?? undefined}>
                {shortenAddress(walletState.address)}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <CardDescription className="leading-7">
                {walletState.address
                  ? 'Primary account exposed by the active connector.'
                  : 'The first authorized account will appear here after connection.'}
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/60 shadow-none">
            <CardHeader className="gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">Chain</Badge>
                <Compass className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-xl">{chainLabel}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              <CardDescription className="leading-7">
                {walletState.chainId
                  ? 'Chain context is derived from the active wagmi connection.'
                  : 'Chain metadata appears after the first successful connection.'}
              </CardDescription>
              {walletState.chainIdHex ? (
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  {walletState.chainIdHex}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-background/60 shadow-none">
            <CardHeader className="gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="secondary">Hyperliquid target</Badge>
                <ShieldCheck className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-xl">{HYPERLIQUID_TARGET_CHAIN.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <CardDescription
                className={cn('leading-7', walletState.isTargetChain === false && 'text-amber-100')}
              >
                {targetCopy}
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {walletState.errorMessage ? (
          <div className="flex gap-3 rounded-[1.5rem] border border-rose-300/20 bg-rose-300/10 p-4 text-rose-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="text-sm leading-7">{walletState.errorMessage}</p>
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-border/60 bg-background/45 p-4">
            <p className="text-sm leading-7 text-muted-foreground">
              Non-custodial by design. Dexera does not custody funds, request signatures, or place
              trades in this shell.
            </p>
          </div>
        )}

        <div className="rounded-[1.5rem] border border-border/60 bg-background/45 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            {walletState.status !== 'connected' ? (
              <>
                <Button
                  type="button"
                  size="lg"
                  disabled={injectedDisabled}
                  onClick={() => {
                    void handleConnect(INJECTED_CONNECTOR_ID);
                  }}
                >
                  {connect.isPending && pendingConnectorId === INJECTED_CONNECTOR_ID
                    ? 'Connecting Injected Wallet...'
                    : 'Connect Injected Wallet'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={walletConnectDisabled}
                  onClick={() => {
                    void handleConnect(WALLETCONNECT_CONNECTOR_ID);
                  }}
                >
                  {connect.isPending && pendingConnectorId === WALLETCONNECT_CONNECTOR_ID
                    ? 'Opening WalletConnect...'
                    : isWalletConnectConfigured
                      ? 'Connect with WalletConnect'
                      : 'WalletConnect Unavailable'}
                </Button>
              </>
            ) : (
              <>
                {showSwitchAction ? (
                  <Button
                    type="button"
                    size="lg"
                    disabled={switchChain.isPending}
                    onClick={() => {
                      void handleSwitchChain();
                    }}
                  >
                    {switchChain.isPending &&
                    switchChain.variables?.chainId === HYPERLIQUID_TARGET_CHAIN.chainId
                      ? 'Switching to HyperEVM...'
                      : 'Switch to HyperEVM'}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="lg"
                  variant={showSwitchAction ? 'outline' : 'secondary'}
                  onClick={handleDisconnect}
                >
                  Disconnect
                </Button>
              </>
            )}
          </div>

          <Separator className="my-5" />

          <p className="text-sm leading-7 text-muted-foreground">
            {isWalletConnectConfigured
              ? 'Injected wallets and WalletConnect remain fully non-custodial. Dexera only controls its local session.'
              : 'Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable WalletConnect. Dexera only controls its local session.'}
          </p>
        </div>
      </div>
    </section>
  );
}
