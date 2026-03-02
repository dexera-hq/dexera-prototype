'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getAuthorizedAccounts,
  getChainId,
  getInjectedProvider,
  normalizeProviderError,
  parseAccountsEvent,
  parseChainIdEvent,
  requestAccounts,
  subscribeToProviderEvent,
} from '../_lib/wallet/eip1193';
import {
  formatChainLabel,
  getChainName,
  hexChainIdToDecimal,
  matchesTargetChain,
  shortenAddress,
} from '../_lib/wallet/format';
import { HYPERLIQUID_TARGET_CHAIN, HYPERLIQUID_TARGET_NOTE } from '../_lib/wallet/hyperliquid';
import type { Eip1193Provider, HexChainId, WalletState, WalletStatus } from '../_lib/wallet/types';

const MANUAL_DISCONNECT_STORAGE_KEY = 'dexera.wallet.manual_disconnect';

function createWalletState({
  status,
  providerPresent,
  address = null,
  chainIdHex = null,
  errorMessage = null,
}: {
  status: WalletStatus;
  providerPresent: boolean;
  address?: string | null;
  chainIdHex?: HexChainId | null;
  errorMessage?: string | null;
}): WalletState {
  const chainIdDecimal = hexChainIdToDecimal(chainIdHex);

  return {
    status,
    providerPresent,
    address,
    chainIdHex,
    chainIdDecimal,
    chainName: getChainName(chainIdDecimal),
    isTargetChain: matchesTargetChain(chainIdHex, HYPERLIQUID_TARGET_CHAIN),
    errorMessage,
  };
}

function getStatusLabel(status: WalletStatus): string {
  switch (status) {
    case 'unsupported':
      return 'No Provider';
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

function getProviderCopy(state: WalletState): string {
  if (!state.providerPresent) {
    return 'No injected wallet detected.';
  }

  switch (state.status) {
    case 'disconnected':
      return 'Wallet available. Connect to expose account and chain context.';
    case 'connecting':
      return 'Waiting for the wallet to confirm account access.';
    case 'connected':
      return 'Connected through a generic injected EIP-1193 provider.';
    case 'error':
      return 'Wallet detected, but Dexera could not complete the handshake.';
    default:
      return 'Wallet is installed and ready for a connection request.';
  }
}

function getTargetCopy(state: WalletState): string {
  if (state.isTargetChain === true) {
    return 'Aligned with the Hyperliquid execution target.';
  }

  if (state.isTargetChain === false) {
    return 'Select HyperEVM before Hyperliquid trading goes live.';
  }

  return HYPERLIQUID_TARGET_NOTE;
}

function hasStorageAccess(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isManuallyDisconnected(): boolean {
  if (!hasStorageAccess()) {
    return false;
  }

  return window.localStorage.getItem(MANUAL_DISCONNECT_STORAGE_KEY) === 'true';
}

function setManualDisconnect(value: boolean): void {
  if (!hasStorageAccess()) {
    return;
  }

  if (value) {
    window.localStorage.setItem(MANUAL_DISCONNECT_STORAGE_KEY, 'true');
    return;
  }

  window.localStorage.removeItem(MANUAL_DISCONNECT_STORAGE_KEY);
}

export function WalletShell() {
  const [walletState, setWalletState] = useState<WalletState>(() =>
    createWalletState({
      status: 'disconnected',
      providerPresent: false,
    }),
  );
  const providerRef = useRef<Eip1193Provider | null>(null);
  const unbindListenersRef = useRef<Array<() => void>>([]);

  const detachListeners = useCallback(() => {
    for (const unbind of unbindListenersRef.current) {
      unbind();
    }

    unbindListenersRef.current = [];
  }, []);

  const syncConnectedState = useCallback(async (provider: Eip1193Provider, address: string) => {
    try {
      const chainIdHex = await getChainId(provider);

      setWalletState(
        createWalletState({
          status: 'connected',
          providerPresent: true,
          address,
          chainIdHex,
        }),
      );
    } catch (error) {
      setWalletState(
        createWalletState({
          status: 'error',
          providerPresent: true,
          address,
          errorMessage: normalizeProviderError(error, 'Unable to read the connected chain.'),
        }),
      );
    }
  }, []);

  const attachListeners = useCallback(
    (provider: Eip1193Provider) => {
      detachListeners();

      const handleAccountsChanged = (payload: unknown) => {
        const accounts = parseAccountsEvent(payload);

        if (accounts.length === 0) {
          setWalletState(
            createWalletState({
              status: 'disconnected',
              providerPresent: true,
            }),
          );
          return;
        }

        const [firstAccount] = accounts;

        if (firstAccount === undefined) {
          return;
        }

        void syncConnectedState(provider, firstAccount);
      };

      const handleChainChanged = (payload: unknown) => {
        try {
          const chainIdHex = parseChainIdEvent(payload);

          setWalletState((current) =>
            createWalletState({
              status: current.address ? 'connected' : 'disconnected',
              providerPresent: true,
              address: current.address,
              chainIdHex,
            }),
          );
        } catch (error) {
          setWalletState((current) =>
            createWalletState({
              status: 'error',
              providerPresent: true,
              address: current.address,
              chainIdHex: current.chainIdHex,
              errorMessage: normalizeProviderError(error, 'Unable to read the current chain.'),
            }),
          );
        }
      };

      const handleDisconnect = (payload?: unknown) => {
        detachListeners();

        setWalletState(
          createWalletState({
            status: 'disconnected',
            providerPresent: true,
            errorMessage: normalizeProviderError(payload, 'Wallet disconnected.'),
          }),
        );
      };

      unbindListenersRef.current = [
        subscribeToProviderEvent(provider, 'accountsChanged', handleAccountsChanged),
        subscribeToProviderEvent(provider, 'chainChanged', handleChainChanged),
        subscribeToProviderEvent(provider, 'disconnect', handleDisconnect),
      ];
    },
    [detachListeners, syncConnectedState],
  );

  useEffect(() => {
    let active = true;
    const provider = getInjectedProvider();

    providerRef.current = provider;

    if (!provider) {
      setWalletState(
        createWalletState({
          status: 'unsupported',
          providerPresent: false,
        }),
      );

      return () => {
        providerRef.current = null;
      };
    }

    const hydrateWallet = async () => {
      const manuallyDisconnected = isManuallyDisconnected();

      try {
        const chainIdHex = await getChainId(provider);

        if (!active) {
          return;
        }

        if (manuallyDisconnected) {
          setWalletState(
            createWalletState({
              status: 'disconnected',
              providerPresent: true,
              chainIdHex,
            }),
          );
          return;
        }

        attachListeners(provider);
        const accounts = await getAuthorizedAccounts(provider);

        if (!active) {
          return;
        }

        if (accounts.length === 0) {
          setWalletState(
            createWalletState({
              status: 'disconnected',
              providerPresent: true,
              chainIdHex,
            }),
          );
          return;
        }

        setWalletState(
          createWalletState({
            status: 'connected',
            providerPresent: true,
            address: accounts[0],
            chainIdHex,
          }),
        );
      } catch (error) {
        if (!active) {
          return;
        }

        setWalletState(
          createWalletState({
            status: 'error',
            providerPresent: true,
            errorMessage: normalizeProviderError(error, 'Unable to read wallet state.'),
          }),
        );
      }
    };

    void hydrateWallet();

    return () => {
      active = false;
      detachListeners();
      providerRef.current = null;
    };
  }, [attachListeners, detachListeners]);

  const handleConnect = useCallback(async () => {
    const provider = providerRef.current ?? getInjectedProvider();

    if (!provider) {
      setWalletState(
        createWalletState({
          status: 'unsupported',
          providerPresent: false,
        }),
      );
      return;
    }

    providerRef.current = provider;

    setWalletState((current) =>
      createWalletState({
        status: 'connecting',
        providerPresent: true,
        address: current.address,
        chainIdHex: current.chainIdHex,
      }),
    );

    try {
      const accounts = await requestAccounts(provider);
      const nextAddress = accounts[0];

      if (!nextAddress) {
        setWalletState(
          createWalletState({
            status: 'error',
            providerPresent: true,
            errorMessage: 'Wallet did not expose an account.',
          }),
        );
        return;
      }

      const chainIdHex = await getChainId(provider);
      setManualDisconnect(false);
      attachListeners(provider);

      setWalletState(
        createWalletState({
          status: 'connected',
          providerPresent: true,
          address: nextAddress,
          chainIdHex,
        }),
      );
    } catch (error) {
      setWalletState(
        createWalletState({
          status: 'error',
          providerPresent: true,
          errorMessage: normalizeProviderError(error, 'Unable to connect to the wallet.'),
        }),
      );
    }
  }, [attachListeners]);

  const handleDisconnect = useCallback(() => {
    setManualDisconnect(true);
    detachListeners();

    setWalletState((current) =>
      createWalletState({
        status: 'disconnected',
        providerPresent: providerRef.current != null,
        chainIdHex: current.chainIdHex,
      }),
    );
  }, [detachListeners]);

  const isConnectButtonVisible = walletState.status !== 'connected';
  const isConnectDisabled =
    walletState.status === 'unsupported' || walletState.status === 'connecting';
  const chainLabel = formatChainLabel(
    walletState.chainName,
    walletState.chainIdHex,
    walletState.chainIdDecimal,
  );
  const targetCopy = getTargetCopy(walletState);

  return (
    <section className="panel wallet-shell">
      <p className="panel-kicker">Wallet Shell</p>
      <div className="wallet-head">
        <div>
          <h1>Connect a wallet without leaving your custody.</h1>
          <p className="panel-intro">
            Dexera only reads your public address and chain context from an injected provider.
            Trading stays disabled while the Hyperliquid flow is still being wired in.
          </p>
        </div>
        <span className={`status-pill tone-${getStatusTone(walletState.status)}`}>
          {getStatusLabel(walletState.status)}
        </span>
      </div>

      <div className="wallet-grid">
        <article className="wallet-card">
          <span className="wallet-label">Provider</span>
          <strong className="wallet-value">
            {walletState.providerPresent ? 'Injected wallet ready' : 'No wallet detected'}
          </strong>
          <p className="wallet-copy">{getProviderCopy(walletState)}</p>
        </article>

        <article className="wallet-card">
          <span className="wallet-label">Address</span>
          <strong className="wallet-value" title={walletState.address ?? undefined}>
            {shortenAddress(walletState.address)}
          </strong>
          <p className="wallet-copy">
            {walletState.address
              ? 'Primary account exposed by the wallet extension.'
              : 'The first authorized account will appear here after connection.'}
          </p>
        </article>

        <article className="wallet-card">
          <span className="wallet-label">Chain</span>
          <strong className="wallet-value">{chainLabel}</strong>
          <p className="wallet-copy">
            {walletState.chainIdHex
              ? 'Chain updates are streamed directly from the provider.'
              : 'Chain metadata appears after provider detection or connection.'}
          </p>
        </article>

        <article className="wallet-card">
          <span className="wallet-label">Hyperliquid target</span>
          <strong className="wallet-value">{HYPERLIQUID_TARGET_CHAIN.name}</strong>
          <p
            className={`wallet-copy${
              walletState.isTargetChain === false ? ' wallet-warning' : ''
            }`}
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
        {isConnectButtonVisible ? (
          <button
            type="button"
            className="action-button"
            disabled={isConnectDisabled}
            onClick={handleConnect}
          >
            {walletState.status === 'connecting' ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : (
          <button
            type="button"
            className="action-button action-button-ghost"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        )}
        <span className="action-note">
          Disconnect only clears Dexera&apos;s local session. Extension authorization remains in
          your wallet.
        </span>
      </div>
    </section>
  );
}
