'use client';

import type { BffPerpOrderSide, BffPerpOrderType, BffVenueId } from '@dexera/api-types/openapi';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getPerpOrderStatus } from './get-perp-order-status';

const RECONCILIATION_POLL_INTERVAL_MS = 4_000;
const MAX_RECONCILIATION_ATTEMPTS = 90;

export type TrackedPerpActionStatus =
  | 'optimistic_submitting'
  | 'submitted'
  | 'reconciling'
  | 'open'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'failed';

export type TrackedPerpAction = {
  id: string;
  accountId: string;
  venue: 'hyperliquid';
  instrument: string;
  side: BffPerpOrderSide;
  type: BffPerpOrderType;
  size: string;
  limitPrice?: string;
  orderId?: string;
  actionHash?: string;
  venueOrderId?: string;
  status: TrackedPerpActionStatus;
  venueStatus?: string;
  submittedAt: string;
  updatedAt: string;
  isTerminal: boolean;
  reconciliationAttempts: number;
  lastError?: string;
};

type TrackedActionByWallet = Record<string, TrackedPerpAction[]>;

function createTrackedActionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `tracked_${Date.now().toString(36)}_${Math.random().toString(16).slice(2, 10)}`;
}

function toWalletKey(accountId: string, venue: BffVenueId): string {
  return `${venue}:${accountId.trim().toLowerCase()}`;
}

export function resolveTrackedPerpActionStatus(parameters: {
  status: string;
  isTerminal: boolean;
}): TrackedPerpActionStatus {
  const normalizedStatus = parameters.status.trim().toLowerCase();
  switch (normalizedStatus) {
    case 'filled':
      return 'filled';
    case 'cancelled':
      return 'cancelled';
    case 'rejected':
      return 'rejected';
    case 'open':
      return 'open';
    case 'submitted':
      return 'reconciling';
    default:
      return parameters.isTerminal ? 'failed' : 'reconciling';
  }
}

export function formatTrackedPerpActionStatusLabel(status: TrackedPerpActionStatus): string {
  switch (status) {
    case 'optimistic_submitting':
      return 'optimistic';
    case 'submitted':
      return 'submitted';
    case 'reconciling':
      return 'reconciling';
    case 'open':
      return 'open';
    case 'filled':
      return 'filled';
    case 'cancelled':
      return 'cancelled';
    case 'rejected':
      return 'rejected';
    case 'failed':
      return 'failed';
    default:
      return status;
  }
}

type UseSubmittedPerpActionsTrackerParameters = {
  activeWallet: {
    accountId: string;
    venue: BffVenueId;
  } | null;
};

export function useSubmittedPerpActionsTracker(
  parameters: UseSubmittedPerpActionsTrackerParameters,
): {
  actions: TrackedPerpAction[];
  addOptimisticAction: (input: {
    accountId: string;
    venue: BffVenueId;
    instrument: string;
    side: BffPerpOrderSide;
    type: BffPerpOrderType;
    size: string;
    limitPrice?: string;
    orderId?: string;
  }) => string | null;
  markActionSubmitted: (input: {
    actionId: string;
    accountId: string;
    venue: BffVenueId;
    orderId: string;
    actionHash: string;
    venueOrderId?: string;
  }) => void;
  markActionFailed: (input: {
    actionId: string;
    accountId: string;
    venue: BffVenueId;
    error: string;
  }) => void;
} {
  const [actionsByWallet, setActionsByWallet] = useState<TrackedActionByWallet>({});
  const actionsByWalletRef = useRef(actionsByWallet);
  const inFlightActionIdsRef = useRef(new Set<string>());

  useEffect(() => {
    actionsByWalletRef.current = actionsByWallet;
  }, [actionsByWallet]);

  const addOptimisticAction = useCallback(
    (input: {
      accountId: string;
      venue: BffVenueId;
      instrument: string;
      side: BffPerpOrderSide;
      type: BffPerpOrderType;
      size: string;
      limitPrice?: string;
      orderId?: string;
    }): string | null => {
      if (input.venue !== 'hyperliquid') {
        return null;
      }

      const walletKey = toWalletKey(input.accountId, input.venue);
      const nextAction: TrackedPerpAction = {
        id: createTrackedActionId(),
        accountId: input.accountId,
        venue: 'hyperliquid',
        instrument: input.instrument.trim().toUpperCase(),
        side: input.side,
        type: input.type,
        size: input.size,
        limitPrice: input.limitPrice,
        orderId: input.orderId,
        status: 'optimistic_submitting',
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isTerminal: false,
        reconciliationAttempts: 0,
      };

      setActionsByWallet((current) => ({
        ...current,
        [walletKey]: [nextAction, ...(current[walletKey] ?? [])].slice(0, 24),
      }));

      return nextAction.id;
    },
    [],
  );

  const markActionSubmitted = useCallback(
    (input: {
      actionId: string;
      accountId: string;
      venue: BffVenueId;
      orderId: string;
      actionHash: string;
      venueOrderId?: string;
    }) => {
      if (input.venue !== 'hyperliquid') {
        return;
      }

      const walletKey = toWalletKey(input.accountId, input.venue);
      setActionsByWallet((current) => {
        const actions = current[walletKey] ?? [];
        const nextActions: TrackedPerpAction[] = actions.map((action): TrackedPerpAction => {
          if (action.id !== input.actionId) {
            return action;
          }

          const hasVenueOrderId = Boolean(
            input.venueOrderId && input.venueOrderId.trim().length > 0,
          );
          return {
            ...action,
            orderId: input.orderId,
            actionHash: input.actionHash,
            venueOrderId: input.venueOrderId,
            status: hasVenueOrderId ? 'reconciling' : 'submitted',
            updatedAt: new Date().toISOString(),
            isTerminal: false,
            lastError: undefined,
          };
        });

        return {
          ...current,
          [walletKey]: nextActions,
        };
      });
    },
    [],
  );

  const markActionFailed = useCallback(
    (input: { actionId: string; accountId: string; venue: BffVenueId; error: string }) => {
      if (input.venue !== 'hyperliquid') {
        return;
      }

      const walletKey = toWalletKey(input.accountId, input.venue);
      setActionsByWallet((current) => {
        const actions = current[walletKey] ?? [];
        const nextActions: TrackedPerpAction[] = actions.map((action): TrackedPerpAction => {
          if (action.id !== input.actionId) {
            return action;
          }

          return {
            ...action,
            status: 'failed' as const,
            updatedAt: new Date().toISOString(),
            isTerminal: true,
            lastError: input.error,
          };
        });

        return {
          ...current,
          [walletKey]: nextActions,
        };
      });
    },
    [],
  );

  const pollOrderStatuses = useCallback(async () => {
    const pendingActions: Array<{ walletKey: string; action: TrackedPerpAction }> = [];

    for (const [walletKey, actions] of Object.entries(actionsByWalletRef.current)) {
      for (const action of actions) {
        const hasVenueOrderId = Boolean(
          action.venueOrderId && action.venueOrderId.trim().length > 0,
        );
        if (!hasVenueOrderId || action.isTerminal || action.venue !== 'hyperliquid') {
          continue;
        }
        if (action.reconciliationAttempts >= MAX_RECONCILIATION_ATTEMPTS) {
          continue;
        }
        if (inFlightActionIdsRef.current.has(action.id)) {
          continue;
        }
        pendingActions.push({ walletKey, action });
      }
    }

    await Promise.all(
      pendingActions.map(async ({ walletKey, action }) => {
        inFlightActionIdsRef.current.add(action.id);
        try {
          const orderStatus = await getPerpOrderStatus({
            accountId: action.accountId,
            venue: 'hyperliquid',
            venueOrderId: action.venueOrderId as string,
            orderId: action.orderId,
          });

          setActionsByWallet((current) => {
            const actions = current[walletKey] ?? [];
            const nextActions: TrackedPerpAction[] = actions.map(
              (candidate): TrackedPerpAction => {
                if (candidate.id !== action.id) {
                  return candidate;
                }

                const nextStatus = resolveTrackedPerpActionStatus({
                  status: orderStatus.status,
                  isTerminal: orderStatus.isTerminal,
                });

                return {
                  ...candidate,
                  status: nextStatus,
                  venueStatus: orderStatus.venueStatus,
                  updatedAt: orderStatus.lastUpdatedAt,
                  isTerminal: orderStatus.isTerminal,
                  reconciliationAttempts: candidate.reconciliationAttempts + 1,
                  lastError: undefined,
                };
              },
            );

            return {
              ...current,
              [walletKey]: nextActions,
            };
          });
        } catch (error) {
          const message =
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : 'Failed to reconcile venue order status.';

          setActionsByWallet((current) => {
            const actions = current[walletKey] ?? [];
            const nextActions: TrackedPerpAction[] = actions.map(
              (candidate): TrackedPerpAction => {
                if (candidate.id !== action.id) {
                  return candidate;
                }

                const nextAttempts = candidate.reconciliationAttempts + 1;
                const shouldFail = nextAttempts >= MAX_RECONCILIATION_ATTEMPTS;
                return {
                  ...candidate,
                  status: shouldFail ? ('failed' as const) : ('reconciling' as const),
                  updatedAt: new Date().toISOString(),
                  isTerminal: shouldFail,
                  reconciliationAttempts: nextAttempts,
                  lastError: message,
                };
              },
            );

            return {
              ...current,
              [walletKey]: nextActions,
            };
          });
        } finally {
          inFlightActionIdsRef.current.delete(action.id);
        }
      }),
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const interval = window.setInterval(() => {
      void pollOrderStatuses();
    }, RECONCILIATION_POLL_INTERVAL_MS);
    void pollOrderStatuses();

    return () => {
      window.clearInterval(interval);
    };
  }, [pollOrderStatuses]);

  const activeWalletActions = useMemo(() => {
    if (!parameters.activeWallet || parameters.activeWallet.venue !== 'hyperliquid') {
      return [];
    }

    return (
      actionsByWallet[
        toWalletKey(parameters.activeWallet.accountId, parameters.activeWallet.venue)
      ] ?? []
    );
  }, [actionsByWallet, parameters.activeWallet]);

  return {
    actions: activeWalletActions,
    addOptimisticAction,
    markActionSubmitted,
    markActionFailed,
  };
}
