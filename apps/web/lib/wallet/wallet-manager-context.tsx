'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  clearRuntimeSlots,
  connectRuntimeSlot,
  disconnectRuntimeSlot,
  isWalletConnectEnabled,
  reconnectRuntimeSlot,
  watchRuntimeSlotAccount,
} from './multi-session-runtime';
import {
  MAX_WALLET_SLOTS,
  clearWalletSessionSlots,
  clearWalletSessionStorage,
  createEmptyWalletSessionState,
  disconnectWalletSlot,
  markWalletSlotStatus,
  readWalletSessionState,
  removeWalletSlot,
  setActiveWalletSlot,
  upsertConnectedWallet,
  writeWalletSessionState,
} from './session-store';
import type {
  ConnectWalletResult,
  WalletConnectorId,
  WalletManagerApi,
  WalletSessionState,
  WalletStateResult,
} from './types';
import {
  getConnectorOptions as buildConnectorOptions,
  isConnectorLocked,
} from './wallet-manager-logic';

const fallbackState = createEmptyWalletSessionState();

function createEphemeralSlotId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `wallet-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

const fallbackWalletManager: WalletManagerApi = {
  slots: fallbackState.slots,
  activeSlot: null,
  activeSlotId: fallbackState.activeSlotId,
  canAddWallet: true,
  hasHydrated: false,
  getConnectorOptions: () => [],
  connectNewSlot: async () => ({
    connected: false,
    reason: 'unavailable',
  }),
  reconnectSlot: async () => ({
    connected: false,
    reason: 'unavailable',
  }),
  setActiveSlot: () => ({
    state: fallbackState,
    changed: false,
    reason: 'unavailable',
  }),
  disconnectSlot: async () => ({
    state: fallbackState,
    changed: false,
    reason: 'unavailable',
  }),
  removeSlot: () => ({
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
  const [sessionState, setSessionState] = useState<WalletSessionState>(
    createEmptyWalletSessionState,
  );
  const [hasHydrated, setHasHydrated] = useState(false);

  const stateRef = useRef(sessionState);
  const hasReconciledPersistedSessions = useRef(false);
  const slotWatchers = useRef(new Map<string, () => void>());

  const walletConnectEnabled = isWalletConnectEnabled();

  useEffect(() => {
    stateRef.current = sessionState;
  }, [sessionState]);

  const stopWatchingSlot = useCallback((slotId: string) => {
    const stopWatching = slotWatchers.current.get(slotId);
    if (!stopWatching) {
      return;
    }

    stopWatching();
    slotWatchers.current.delete(slotId);
  }, []);

  const stopWatchingAllSlots = useCallback(() => {
    for (const stopWatching of slotWatchers.current.values()) {
      stopWatching();
    }

    slotWatchers.current.clear();
  }, []);

  const startWatchingSlot = useCallback((slotId: string) => {
    if (slotWatchers.current.has(slotId)) {
      return;
    }

    const unwatch = watchRuntimeSlotAccount(slotId, (account) => {
      setSessionState((currentState) => {
        const currentSlot = currentState.slots.find((slot) => slot.id === slotId);

        if (!currentSlot) {
          return currentState;
        }

        if (!account.isConnected || !account.address || !account.chainId || !account.connectorId) {
          const staleResult = markWalletSlotStatus(currentState, slotId, 'stale');
          return staleResult.changed ? staleResult.state : currentState;
        }

        const nextResult = upsertConnectedWallet(currentState, {
          slotId,
          address: account.address,
          chainId: account.chainId,
          connectorId: account.connectorId,
          label: account.connectorLabel,
        });

        return nextResult.changed ? nextResult.state : currentState;
      });
    });

    slotWatchers.current.set(slotId, unwatch);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    setSessionState(readWalletSessionState(window.localStorage));
    setHasHydrated(true);
  }, []);

  useEffect(() => {
    if (!hasHydrated || typeof window === 'undefined') {
      return;
    }

    if (sessionState.slots.length === 0 && sessionState.activeSlotId === null) {
      clearWalletSessionStorage(window.localStorage);
      return;
    }

    writeWalletSessionState(window.localStorage, sessionState);
  }, [hasHydrated, sessionState]);

  useEffect(() => {
    if (!hasHydrated || hasReconciledPersistedSessions.current) {
      return;
    }

    let isCancelled = false;

    async function reconcilePersistedSessions() {
      const previousState = stateRef.current;
      const lockedConnectors = new Set<WalletConnectorId>();
      let nextState = previousState;

      for (const slot of previousState.slots) {
        if (slot.status !== 'connected') {
          continue;
        }

        if (lockedConnectors.has(slot.connectorId)) {
          const lockedResult = markWalletSlotStatus(nextState, slot.id, 'stale');
          nextState = lockedResult.state;
          continue;
        }

        if (slot.connectorId === 'walletConnect' && !walletConnectEnabled) {
          const disabledResult = markWalletSlotStatus(nextState, slot.id, 'stale');
          nextState = disabledResult.state;
          continue;
        }

        const reconnectResult = await reconnectRuntimeSlot(slot.id, slot.connectorId);

        if (
          !reconnectResult.connected ||
          !reconnectResult.account?.address ||
          !reconnectResult.account?.chainId ||
          !reconnectResult.account.connectorId
        ) {
          const staleResult = markWalletSlotStatus(nextState, slot.id, 'stale');
          nextState = staleResult.state;
          continue;
        }

        const upsertResult = upsertConnectedWallet(nextState, {
          slotId: slot.id,
          address: reconnectResult.account.address,
          chainId: reconnectResult.account.chainId,
          connectorId: reconnectResult.account.connectorId,
          label: reconnectResult.account.connectorLabel,
        });

        nextState = upsertResult.state;
        lockedConnectors.add(slot.connectorId);

        if (!isCancelled) {
          startWatchingSlot(slot.id);
        }
      }

      if (isCancelled) {
        return;
      }

      hasReconciledPersistedSessions.current = true;
      setSessionState(nextState);
    }

    void reconcilePersistedSessions();

    return () => {
      isCancelled = true;
    };
  }, [hasHydrated, startWatchingSlot, walletConnectEnabled]);

  useEffect(() => {
    return () => {
      stopWatchingAllSlots();
    };
  }, [stopWatchingAllSlots]);

  const getConnectorOptions = useCallback(() => {
    return buildConnectorOptions({
      slots: sessionState.slots,
      walletConnectEnabled,
    });
  }, [sessionState.slots, walletConnectEnabled]);

  const connectNewSlot = useCallback(
    async (connectorId: WalletConnectorId): Promise<ConnectWalletResult> => {
      if (!hasHydrated || stateRef.current.slots.length >= MAX_WALLET_SLOTS) {
        return {
          connected: false,
          reason: 'unavailable',
        };
      }

      if (connectorId === 'walletConnect' && !walletConnectEnabled) {
        return {
          connected: false,
          reason: 'connector-missing',
        };
      }

      if (isConnectorLocked(stateRef.current.slots, connectorId)) {
        return {
          connected: false,
          reason: 'connector-in-use',
        };
      }

      const slotId = createEphemeralSlotId();
      let shouldClearRuntime = true;

      try {
        const connectResult = await connectRuntimeSlot(slotId, connectorId);

        if (
          !connectResult.connected ||
          !connectResult.account?.address ||
          !connectResult.account.chainId ||
          !connectResult.account.connectorId
        ) {
          return {
            connected: false,
            reason: connectResult.reason,
          };
        }

        const nextResult = upsertConnectedWallet(stateRef.current, {
          slotId,
          address: connectResult.account.address,
          chainId: connectResult.account.chainId,
          connectorId: connectResult.account.connectorId,
          label: connectResult.account.connectorLabel,
        });

        if (!nextResult.changed) {
          return {
            connected: false,
            reason: nextResult.reason === 'slots-full' ? 'unavailable' : 'failed',
          };
        }

        setSessionState(nextResult.state);
        startWatchingSlot(slotId);
        shouldClearRuntime = false;

        return {
          connected: true,
          reason: connectResult.reason,
        };
      } finally {
        if (shouldClearRuntime) {
          await clearRuntimeSlots([slotId]);
        }
      }
    },
    [hasHydrated, startWatchingSlot, walletConnectEnabled],
  );

  const reconnectSlot = useCallback(
    async (slotId: string): Promise<ConnectWalletResult> => {
      const slot = stateRef.current.slots.find((candidate) => candidate.id === slotId);

      if (!slot) {
        return {
          connected: false,
          reason: 'unavailable',
        };
      }

      if (slot.connectorId === 'walletConnect' && !walletConnectEnabled) {
        return {
          connected: false,
          reason: 'connector-missing',
        };
      }

      if (isConnectorLocked(stateRef.current.slots, slot.connectorId, slotId)) {
        return {
          connected: false,
          reason: 'connector-in-use',
        };
      }

      const reconnectResult = await reconnectRuntimeSlot(slotId, slot.connectorId);

      if (
        !reconnectResult.connected ||
        !reconnectResult.account?.address ||
        !reconnectResult.account.chainId ||
        !reconnectResult.account.connectorId
      ) {
        const staleResult = markWalletSlotStatus(stateRef.current, slotId, 'stale');

        if (staleResult.changed) {
          setSessionState(staleResult.state);
        }

        return {
          connected: false,
          reason: reconnectResult.reason,
        };
      }

      const nextResult = upsertConnectedWallet(stateRef.current, {
        slotId,
        address: reconnectResult.account.address,
        chainId: reconnectResult.account.chainId,
        connectorId: reconnectResult.account.connectorId,
        label: reconnectResult.account.connectorLabel,
      });

      if (nextResult.changed) {
        setSessionState(nextResult.state);
      }

      startWatchingSlot(slotId);

      return {
        connected: true,
        reason: reconnectResult.reason,
      };
    },
    [startWatchingSlot, walletConnectEnabled],
  );

  const setActiveSlot = useCallback((slotId: string): WalletStateResult => {
    const nextResult = setActiveWalletSlot(stateRef.current, slotId);

    if (nextResult.changed) {
      setSessionState(nextResult.state);
    }

    return nextResult;
  }, []);

  const disconnectSlot = useCallback(
    async (slotId: string): Promise<WalletStateResult> => {
      const slot = stateRef.current.slots.find((candidate) => candidate.id === slotId);

      if (!slot) {
        return {
          state: stateRef.current,
          changed: false,
          reason: 'slot-not-found',
        };
      }

      stopWatchingSlot(slotId);
      await disconnectRuntimeSlot(slotId);

      const nextResult = disconnectWalletSlot(stateRef.current, slotId);

      if (nextResult.changed) {
        setSessionState(nextResult.state);
      }

      return nextResult;
    },
    [stopWatchingSlot],
  );

  const removeSlot = useCallback(
    (slotId: string): WalletStateResult => {
      stopWatchingSlot(slotId);
      void clearRuntimeSlots([slotId]);

      const nextResult = removeWalletSlot(stateRef.current, slotId);

      if (nextResult.changed) {
        setSessionState(nextResult.state);
      }

      return nextResult;
    },
    [stopWatchingSlot],
  );

  const clearAllSlots = useCallback((): WalletStateResult => {
    const slotIds = stateRef.current.slots.map((slot) => slot.id);

    stopWatchingAllSlots();
    void clearRuntimeSlots(slotIds);

    const nextResult = clearWalletSessionSlots();
    setSessionState(nextResult.state);

    return nextResult;
  }, [stopWatchingAllSlots]);

  const activeSlot = useMemo(
    () => sessionState.slots.find((slot) => slot.id === sessionState.activeSlotId) ?? null,
    [sessionState.activeSlotId, sessionState.slots],
  );

  return (
    <WalletManagerContext.Provider
      value={{
        slots: sessionState.slots,
        activeSlot,
        activeSlotId: sessionState.activeSlotId,
        canAddWallet: sessionState.slots.length < MAX_WALLET_SLOTS,
        hasHydrated,
        getConnectorOptions,
        connectNewSlot,
        reconnectSlot,
        setActiveSlot,
        disconnectSlot,
        removeSlot,
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
