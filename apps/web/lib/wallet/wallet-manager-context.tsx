'use client';

import type { VenueId } from '@dexera/shared-types';
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
  signRuntimeSlotMessage,
  watchRuntimeSlotAccount,
} from './multi-session-runtime';
import {
  MAX_WALLET_SLOTS,
  accountIdsMatch,
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
import { requestWalletChallenge, verifyWalletOwnership } from './verification';

const fallbackState = createEmptyWalletSessionState();

function createEphemeralSlotId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `wallet-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return 'Wallet verification failed. Reconnect and sign the challenge again.';
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

  const walletRuntimeEnabled = isWalletConnectEnabled();

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

  const verifySlotOwnership = useCallback(
    async (slotId: string, accountId: string, venue: VenueId): Promise<void> => {
      setSessionState((currentState) => {
        const slot = currentState.slots.find((candidate) => candidate.id === slotId);
        if (
          !slot ||
          slot.status !== 'connected' ||
          !accountIdsMatch(slot.accountId, accountId)
        ) {
          return currentState;
        }

        const pendingResult = upsertConnectedWallet(currentState, {
          slotId,
          accountId,
          venue,
          connectorId: slot.connectorId,
          label: slot.label,
          connectedAt: slot.lastConnectedAt,
          ownershipStatus: 'unverified',
          eligibilityStatus: 'checking',
          eligibilityReason: '',
          lastVerifiedAt: '',
        });

        return pendingResult.changed ? pendingResult.state : currentState;
      });

      try {
        const challenge = await requestWalletChallenge({ address: accountId });
        const signature = await signRuntimeSlotMessage({
          slotId,
          accountId,
          message: challenge.message,
        });

        const verification = await verifyWalletOwnership({
          address: accountId,
          challengeId: challenge.challengeId,
          signature,
          venue,
        });

        setSessionState((currentState) => {
          const slot = currentState.slots.find((candidate) => candidate.id === slotId);
          if (
            !slot ||
            slot.status !== 'connected' ||
            !accountIdsMatch(slot.accountId, accountId)
          ) {
            return currentState;
          }

          const nextResult = upsertConnectedWallet(currentState, {
            slotId,
            accountId,
            venue,
            connectorId: slot.connectorId,
            label: slot.label,
            connectedAt: slot.lastConnectedAt,
            ownershipStatus: verification.ownershipVerified ? 'verified' : 'failed',
            eligibilityStatus:
              verification.ownershipVerified && verification.eligible ? 'tradable' : 'not-eligible',
            eligibilityReason: verification.eligible ? '' : verification.reason,
            lastVerifiedAt: verification.checkedAt,
          });

          return nextResult.changed ? nextResult.state : currentState;
        });
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        setSessionState((currentState) => {
          const slot = currentState.slots.find((candidate) => candidate.id === slotId);
          if (
            !slot ||
            slot.status !== 'connected' ||
            !accountIdsMatch(slot.accountId, accountId)
          ) {
            return currentState;
          }

          const nextResult = upsertConnectedWallet(currentState, {
            slotId,
            accountId,
            venue,
            connectorId: slot.connectorId,
            label: slot.label,
            connectedAt: slot.lastConnectedAt,
            ownershipStatus: 'failed',
            eligibilityStatus: 'error',
            eligibilityReason: errorMessage,
            lastVerifiedAt: '',
          });

          return nextResult.changed ? nextResult.state : currentState;
        });
      }
    },
    [],
  );

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

        if (!account.isConnected || !account.accountId || !account.connectorId) {
          const staleResult = markWalletSlotStatus(currentState, slotId, 'stale');
          return staleResult.changed ? staleResult.state : currentState;
        }

        const accountChanged = !accountIdsMatch(account.accountId, currentSlot.accountId);
        const nextResult = upsertConnectedWallet(currentState, {
          slotId,
          accountId: account.accountId,
          venue: currentSlot.venue,
          connectorId: account.connectorId,
          label: account.connectorLabel,
          connectedAt: currentSlot.lastConnectedAt,
          ownershipStatus: accountChanged ? 'unverified' : currentSlot.ownershipStatus,
          eligibilityStatus: accountChanged ? 'unknown' : currentSlot.eligibilityStatus,
          eligibilityReason: accountChanged
            ? 'Connected account changed. Reconnect this slot to verify eligibility.'
            : currentSlot.eligibilityReason,
          lastVerifiedAt: accountChanged ? '' : currentSlot.lastVerifiedAt,
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

        if (!walletRuntimeEnabled) {
          const disabledResult = markWalletSlotStatus(nextState, slot.id, 'stale');
          nextState = disabledResult.state;
          continue;
        }

        const reconnectResult = await reconnectRuntimeSlot(slot.id, slot.connectorId);

        if (
          !reconnectResult.connected ||
          !reconnectResult.account?.accountId ||
          !reconnectResult.account.connectorId
        ) {
          const staleResult = markWalletSlotStatus(nextState, slot.id, 'stale');
          nextState = staleResult.state;
          continue;
        }

        const upsertResult = upsertConnectedWallet(nextState, {
          slotId: slot.id,
          accountId: reconnectResult.account.accountId,
          venue: slot.venue,
          connectorId: reconnectResult.account.connectorId,
          label: reconnectResult.account.connectorLabel,
          connectedAt: slot.lastConnectedAt,
          ownershipStatus: 'unverified',
          eligibilityStatus: 'checking',
          eligibilityReason: '',
          lastVerifiedAt: '',
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

      for (const slot of nextState.slots) {
        if (slot.status !== 'connected') {
          continue;
        }

        await verifySlotOwnership(slot.id, slot.accountId, slot.venue);
      }
    }

    void reconcilePersistedSessions();

    return () => {
      isCancelled = true;
    };
  }, [hasHydrated, startWatchingSlot, verifySlotOwnership, walletRuntimeEnabled]);

  useEffect(() => {
    return () => {
      stopWatchingAllSlots();
    };
  }, [stopWatchingAllSlots]);

  const getConnectorOptions = useCallback(() => {
    return buildConnectorOptions({
      slots: sessionState.slots,
      runtimeEnabled: walletRuntimeEnabled,
    });
  }, [sessionState.slots, walletRuntimeEnabled]);

  const connectNewSlot = useCallback(
    async (connectorId: WalletConnectorId, venue: VenueId): Promise<ConnectWalletResult> => {
      if (!hasHydrated || stateRef.current.slots.length >= MAX_WALLET_SLOTS) {
        return {
          connected: false,
          reason: 'unavailable',
        };
      }

      if (!walletRuntimeEnabled) {
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
          !connectResult.account?.accountId ||
          !connectResult.account.connectorId
        ) {
          return {
            connected: false,
            reason: connectResult.reason,
          };
        }

        const nextResult = upsertConnectedWallet(stateRef.current, {
          slotId,
          accountId: connectResult.account.accountId,
          venue,
          connectorId: connectResult.account.connectorId,
          label: connectResult.account.connectorLabel,
          ownershipStatus: 'unverified',
          eligibilityStatus: 'checking',
          eligibilityReason: '',
          lastVerifiedAt: '',
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

        await verifySlotOwnership(slotId, connectResult.account.accountId, venue);

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
    [hasHydrated, startWatchingSlot, verifySlotOwnership, walletRuntimeEnabled],
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

      if (!walletRuntimeEnabled) {
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
        !reconnectResult.account?.accountId ||
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
        accountId: reconnectResult.account.accountId,
        venue: slot.venue,
        connectorId: reconnectResult.account.connectorId,
        label: reconnectResult.account.connectorLabel,
        connectedAt: slot.lastConnectedAt,
        ownershipStatus: 'unverified',
        eligibilityStatus: 'checking',
        eligibilityReason: '',
        lastVerifiedAt: '',
      });

      if (nextResult.changed) {
        setSessionState(nextResult.state);
      }

      startWatchingSlot(slotId);
      await verifySlotOwnership(slotId, reconnectResult.account.accountId, slot.venue);

      return {
        connected: true,
        reason: reconnectResult.reason,
      };
    },
    [startWatchingSlot, verifySlotOwnership, walletRuntimeEnabled],
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
