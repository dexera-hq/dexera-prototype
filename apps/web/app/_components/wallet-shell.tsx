'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useAccount,
  useChainId,
  useConnect,
  useConnectors,
  useDisconnect,
  useSwitchChain,
} from 'wagmi';
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

function getStatusTone(status: WalletStatus): string {
  switch (status) {
    case 'unsupported':
      return 'unsupported';
    case 'disconnected':
      return 'neutral';
    case 'connecting':
      return 'pending';
    case 'connected':
      return 'success';
    case 'error':
      return 'error';
    default:
      return 'neutral';
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
    <section className="panel wallet-shell">
      <p className="panel-kicker">Wallet Shell</p>
      <div className="wallet-head">
        <div>
          <h1>Connect a wallet without leaving your custody.</h1>
          <p className="panel-intro">
            Dexera uses wagmi and viem for non-custodial wallet connectivity. It only reads your
            public address and chain context while Hyperliquid trading remains disabled.
          </p>
        </div>
        <span className={`status-pill tone-${getStatusTone(walletStatus)}`}>
          {getStatusLabel(walletStatus)}
        </span>
      </div>

      <div className="wallet-grid">
        <article className="wallet-card">
          <span className="wallet-label">Connectors</span>
          <strong className="wallet-value">
            {walletState.connectorName ??
              (walletState.connectorReady ? 'Dexera connectors ready' : 'No connector available')}
          </strong>
          <p className="wallet-copy">{getConnectorCopy(walletState, hasInjectedProvider)}</p>
        </article>

        <article className="wallet-card">
          <span className="wallet-label">Address</span>
          <strong className="wallet-value" title={walletState.address ?? undefined}>
            {shortenAddress(walletState.address)}
          </strong>
          <p className="wallet-copy">
            {walletState.address
              ? 'Primary account exposed by the active connector.'
              : 'The first authorized account will appear here after connection.'}
          </p>
        </article>

        <article className="wallet-card">
          <span className="wallet-label">Chain</span>
          <strong className="wallet-value">{chainLabel}</strong>
          <p className="wallet-copy">
            {walletState.chainId
              ? 'Chain context is derived from the active wagmi connection.'
              : 'Chain metadata appears after the first successful connection.'}
          </p>
        </article>

        <article className="wallet-card">
          <span className="wallet-label">Hyperliquid target</span>
          <strong className="wallet-value">{HYPERLIQUID_TARGET_CHAIN.name}</strong>
          <p
            className={`wallet-copy${walletState.isTargetChain === false ? ' wallet-warning' : ''}`}
          >
            {targetCopy}
          </p>
        </article>
      </div>

      {walletState.errorMessage ? (
        <p className="wallet-alert" role="alert">
          {walletState.errorMessage}
        </p>
      ) : (
        <p className="wallet-note">
          Non-custodial by design. Dexera does not custody funds, request signatures, or place
          trades in this shell.
        </p>
      )}

      <div className="wallet-actions">
        {walletState.status !== 'connected' ? (
          <>
            <button
              type="button"
              className="action-button"
              disabled={injectedDisabled}
              onClick={() => {
                void handleConnect(INJECTED_CONNECTOR_ID);
              }}
            >
              {connect.isPending && pendingConnectorId === INJECTED_CONNECTOR_ID
                ? 'Connecting Injected Wallet...'
                : 'Connect Injected Wallet'}
            </button>
            <button
              type="button"
              className="action-button action-button-ghost"
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
            </button>
          </>
        ) : (
          <>
            {showSwitchAction ? (
              <button
                type="button"
                className="action-button"
                disabled={switchChain.isPending}
                onClick={() => {
                  void handleSwitchChain();
                }}
              >
                {switchChain.isPending &&
                switchChain.variables?.chainId === HYPERLIQUID_TARGET_CHAIN.chainId
                  ? 'Switching to HyperEVM...'
                  : 'Switch to HyperEVM'}
              </button>
            ) : null}
            <button
              type="button"
              className={`action-button${showSwitchAction ? ' action-button-ghost' : ''}`}
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
          </>
        )}
        <span className="action-note">
          {isWalletConnectConfigured
            ? 'Injected wallets and WalletConnect remain fully non-custodial. Dexera only controls its local session.'
            : 'Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to enable WalletConnect. Dexera only controls its local session.'}
        </span>
      </div>
    </section>
  );
}
