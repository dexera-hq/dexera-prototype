'use client';

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';

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

const WalletManagerContext = createContext<WalletManagerApi | null>(null);

export function WalletManagerProvider({ children }: { children: ReactNode }) {
  const [sessionState, setSessionState] = useState<WalletSessionState>(createEmptyWalletSessionState);
  const [hasHydrated, setHasHydrated] = useState(false);
  const hasReconciledInitialSession = useRef(false);

  const { address, chainId, connector, isConnected, status } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const { openConnectModal } = useConnectModal();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setSessionState(readWalletSessionState(window.localStorage));
    setHasHydrated(true);
  }, []);

  const persistSessionState = useEffectEvent((nextState: WalletSessionState) => {
    if (typeof window === 'undefined') {
      return;
    }

    if (nextState.slots.length === 0 && nextState.activeSlotId === null) {
      clearWalletSessionStorage(window.localStorage);
      return;
    }

    writeWalletSessionState(window.localStorage, nextState);
  });

  const applyConnectedSession = useEffectEvent((): WalletStateResult => {
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
  });

  const reconcilePersistedSessions = useEffectEvent(() => {
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
  });

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    persistSessionState(sessionState);
  }, [hasHydrated, sessionState]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    reconcilePersistedSessions();
  }, [hasHydrated, status, address, chainId, connector?.id]);

  useEffect(() => {
    if (!hasHydrated || !isConnected || !address || !chainId || !connector?.id) {
      return;
    }

    applyConnectedSession();
  }, [hasHydrated, isConnected, address, chainId, connector?.id, connector?.name]);

  function connectWallet(): ConnectWalletResult {
    if (!openConnectModal) {
      return {
        opened: false,
        reason: 'unavailable',
      };
    }

    openConnectModal();

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
  const context = useContext(WalletManagerContext);

  if (!context) {
    throw new Error('useWalletManager must be used within WalletManagerProvider');
  }

  return context;
}
