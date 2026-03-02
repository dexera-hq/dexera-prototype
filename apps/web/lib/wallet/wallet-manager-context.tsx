'use client';

import { useConnectModal } from '@rainbow-me/rainbowkit';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

import {
  MAX_WALLET_SLOTS,
  clearWalletSessionSlots,
  clearWalletSessionStorage,
  createEmptyWalletSessionState,
  markAllWalletSlots,
  readWalletSessionState,
  removeWalletSlot,
  setActiveWalletSlot,
  upsertConnectedWallet,
  walletAddressesMatch,
  writeWalletSessionState,
} from './session-store';
import type { ConnectWalletResult, WalletManagerApi, WalletSessionState, WalletStateResult } from './types';

const fallbackState = createEmptyWalletSessionState();

const fallbackWalletManager: WalletManagerApi = {
  slots: fallbackState.slots,
  activeSlot: null,
  activeSlotId: fallbackState.activeSlotId,
  canAddWallet: true,
  connectWallet: () => ({
    opened: false,
    reason: 'unavailable',
  }),
  syncFromWagmiSession: () => ({
    state: fallbackState,
    changed: false,
    reason: 'no-live-session',
  }),
  setActiveSlot: () => ({
    state: fallbackState,
    changed: false,
    reason: 'unavailable',
  }),
  disconnectSlot: () => ({
    state: fallbackState,
    changed: false,
    reason: 'unavailable',
  }),
  replaceSlot: () => ({
    state: fallbackState,
    changed: false,
    reason: 'unavailable',
  }),
  clearAllSlots: () => ({
    state: fallbackState,
    changed: false,
    reason: 'cleared',
  }),
};

const WalletManagerContext = createContext<WalletManagerApi>(fallbackWalletManager);

export function WalletManagerProvider({ children }: { children: ReactNode }) {
  const [sessionState, setSessionState] = useState<WalletSessionState>(createEmptyWalletSessionState);
  const [hasHydrated, setHasHydrated] = useState(false);
  const hasReconciledInitialSession = useRef(false);

  const { address, chainId, connector, isConnected, status } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { connectAsync, connectors } = useConnect();
  const { disconnectAsync } = useDisconnect();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setSessionState(readWalletSessionState(window.localStorage));
    setHasHydrated(true);
  }, []);

  const persistSessionState = useCallback((nextState: WalletSessionState) => {
    if (typeof window === 'undefined') {
      return;
    }

    if (nextState.slots.length === 0 && nextState.activeSlotId === null) {
      clearWalletSessionStorage(window.localStorage);
      return;
    }

    writeWalletSessionState(window.localStorage, nextState);
  }, []);

  const applyConnectedSession = useCallback((): WalletStateResult => {
    if (!address || !chainId || !connector?.id) {
      return {
        state: sessionState,
        changed: false,
        reason: 'no-live-session',
      };
    }

    const nextResult = upsertConnectedWallet(sessionState, {
      address,
      chainId,
      connectorId: connector.id,
      label: connector.name,
    });

    if (nextResult.changed) {
      setSessionState(nextResult.state);
    }

    hasReconciledInitialSession.current = true;

    return nextResult;
  }, [address, chainId, connector?.id, connector?.name, sessionState]);

  const reconcilePersistedSessions = useCallback(() => {
    if (hasReconciledInitialSession.current) {
      return;
    }

    if (status === 'connecting' || status === 'reconnecting') {
      return;
    }

    if (status === 'connected') {
      applyConnectedSession();
      return;
    }

    const nextResult = markAllWalletSlots(sessionState, 'stale');

    if (nextResult.changed) {
      setSessionState(nextResult.state);
    }

    hasReconciledInitialSession.current = true;
  }, [applyConnectedSession, sessionState, status]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    persistSessionState(sessionState);
  }, [hasHydrated, persistSessionState, sessionState]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    reconcilePersistedSessions();
  }, [address, chainId, connector?.id, hasHydrated, reconcilePersistedSessions, status]);

  useEffect(() => {
    if (!hasHydrated || !isConnected || !address || !chainId || !connector?.id) {
      return;
    }

    applyConnectedSession();
  }, [address, applyConnectedSession, chainId, connector?.id, hasHydrated, isConnected]);

  function connectWallet(): ConnectWalletResult {
    if (openConnectModal) {
      openConnectModal();

      return {
        opened: true,
        reason: 'opened',
      };
    }

    const targetConnector =
      connectors.find((candidate) => candidate.id === 'injected') ??
      connectors.find((candidate) => candidate.id === 'coinbaseWalletSDK') ??
      connectors[0];

    if (!targetConnector) {
      return {
        opened: false,
        reason: 'unavailable',
      };
    }

    void connectAsync({ connector: targetConnector }).catch(() => undefined);

    return {
      opened: true,
      reason: 'opened',
    };
  }

  function syncFromWagmiSession(): WalletStateResult {
    return applyConnectedSession();
  }

  function setActiveSlot(slotId: string): WalletStateResult {
    const nextResult = setActiveWalletSlot(sessionState, slotId);

    if (nextResult.changed) {
      setSessionState(nextResult.state);
    }

    return nextResult;
  }

  function disconnectSlot(slotId: string): WalletStateResult {
    const slot = sessionState.slots.find((candidate) => candidate.id === slotId);
    const nextResult = removeWalletSlot(sessionState, slotId);

    if (!nextResult.changed) {
      return nextResult;
    }

    setSessionState(nextResult.state);

    if (
      slot &&
      address &&
      connector?.id &&
      walletAddressesMatch(slot.address, address) &&
      slot.connectorId === connector.id
    ) {
      void disconnectAsync().catch(() => undefined);
    }

    return nextResult;
  }

  function replaceSlot(slotId: string): WalletStateResult {
    const nextResult = disconnectSlot(slotId);

    if (nextResult.changed) {
      connectWallet();
    }

    return nextResult;
  }

  function clearAllSlots(): WalletStateResult {
    const nextResult = clearWalletSessionSlots();

    setSessionState(nextResult.state);

    if (isConnected) {
      void disconnectAsync().catch(() => undefined);
    }

    return nextResult;
  }

  const activeSlot = sessionState.slots.find((slot) => slot.id === sessionState.activeSlotId) ?? null;

  return (
    <WalletManagerContext.Provider
      value={{
        slots: sessionState.slots,
        activeSlot,
        activeSlotId: sessionState.activeSlotId,
        canAddWallet: sessionState.slots.length < MAX_WALLET_SLOTS,
        connectWallet,
        syncFromWagmiSession,
        setActiveSlot,
        disconnectSlot,
        replaceSlot,
        clearAllSlots,
      }}
    >
      {children}
    </WalletManagerContext.Provider>
  );
}

export function useWalletManager(): WalletManagerApi {
  return useContext(WalletManagerContext);
}
