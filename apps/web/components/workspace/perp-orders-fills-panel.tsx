'use client';

import type { PerpFill } from '@/lib/market-data/types';
import { buildUnsignedCancelAction } from '@/lib/wallet/build-unsigned-cancel-action';
import { useEffect, useMemo, useState } from 'react';
import { getPerpFills } from '@/lib/market-data/get-perp-fills';
import { getWalletVenueLabel } from '@/lib/wallet/chains';
import { signRuntimeSlotActionPayload } from '@/lib/wallet/multi-session-runtime';
import { submitSignedAction } from '@/lib/wallet/submit-signed-action';
import { TransactionGuardrailError } from '@/lib/wallet/transaction-guardrails';
import {
  formatTrackedPerpActionStatusLabel,
  resolveTrackedPerpActionCancelState,
  type TrackedPerpAction,
  useSubmittedPerpActionsTracker,
} from '@/lib/wallet/use-submitted-perp-actions';
import { useWalletManager } from '@/lib/wallet/wallet-manager-context';

function formatTimestamp(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) {
    return isoTimestamp;
  }

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatPrice(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return `$${parsed.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type ActivityRow =
  | {
      id: string;
      rowKey: string;
      timestamp: string;
      type: 'Order';
      instrument: string;
      side: string;
      size: string;
      status: string;
      statusClassName: string;
      venueLabel: string;
      details: string;
      cancelState: 'available' | 'pending' | 'unsupported';
      action?: TrackedPerpAction;
    }
  | {
      id: string;
      rowKey: string;
      timestamp: string;
      type: 'Fill';
      instrument: string;
      side: string;
      size: string;
      status: 'filled';
      statusClassName: string;
      venueLabel: string;
      details: string;
      cancelState: 'unsupported';
    };

function toOrderRow(action: TrackedPerpAction): ActivityRow {
  return {
    id: action.id,
    rowKey: `order:${action.id}`,
    timestamp: action.updatedAt,
    type: 'Order',
    instrument: action.instrument,
    side: action.side.toUpperCase(),
    size: action.size,
    status: formatTrackedPerpActionStatusLabel(action.status),
    statusClassName: `status-${action.status}`,
    venueLabel: getWalletVenueLabel(action.venue),
    details: action.orderId ? `order ${action.orderId}` : 'order pending',
    cancelState: resolveTrackedPerpActionCancelState(action),
    action,
  };
}

function toFillRow(fill: PerpFill): ActivityRow {
  return {
    id: fill.id,
    rowKey: `fill:${fill.venue}:${fill.accountId}:${fill.id}:${fill.orderId}:${fill.filledAt}`,
    timestamp: fill.filledAt,
    type: 'Fill',
    instrument: fill.instrument,
    side: fill.side.toUpperCase(),
    size: fill.size,
    status: 'filled',
    statusClassName: 'status-filled',
    venueLabel: getWalletVenueLabel(fill.venue),
    details: `${formatPrice(fill.price)} · order ${fill.orderId}`,
    cancelState: 'unsupported',
  };
}

export function PerpOrdersFillsPanel() {
  const { activeSlot } = useWalletManager();
  const {
    actions,
    markActionCancelFailed,
    markActionCancelStarted,
    markActionCancelSubmitted,
  } = useSubmittedPerpActionsTracker();
  const [fills, setFills] = useState<PerpFill[]>([]);
  const [fillsLoading, setFillsLoading] = useState(false);
  const [fillsError, setFillsError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSlot) {
      setFills([]);
      setFillsError(null);
      setFillsLoading(false);
      return;
    }

    const abortController = new AbortController();
    setFillsLoading(true);
    setFillsError(null);

    const fillsRequest =
      activeSlot.venue === 'hyperliquid'
        ? getPerpFills(
            {
              accountId: activeSlot.accountId,
              venue: 'hyperliquid',
            },
            {
              fetchImpl: (input, init) => fetch(input, { ...init, signal: abortController.signal }),
            },
          ).then((response) => response.fills as PerpFill[])
        : fetch(
            `/api/mock/fills?venue=${encodeURIComponent(activeSlot.venue)}&accountId=${encodeURIComponent(activeSlot.accountId)}`,
            { signal: abortController.signal },
          ).then(async (response) => {
            if (!response.ok) {
              throw new Error(`Fills request failed (${response.status})`);
            }

            return (await response.json()) as PerpFill[];
          });

    void fillsRequest
      .then((payload) => {
        if (!abortController.signal.aborted) {
          setFills(payload);
          setFillsLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (abortController.signal.aborted) {
          return;
        }

        setFills([]);
        setFillsLoading(false);
        setFillsError(error instanceof Error ? error.message : 'Unable to load fills');
      });

    return () => {
      abortController.abort();
    };
  }, [activeSlot]);

  const rows = useMemo(() => {
    const nextRows = [...actions.map(toOrderRow), ...fills.map(toFillRow)];
    const seenRowKeys = new Set<string>();
    const dedupedRows = nextRows.filter((row) => {
      if (seenRowKeys.has(row.rowKey)) {
        return false;
      }
      seenRowKeys.add(row.rowKey);
      return true;
    });
    dedupedRows.sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
    return dedupedRows.slice(0, 24);
  }, [actions, fills]);

  async function handleCancelAction(action: TrackedPerpAction) {
    if (!activeSlot || activeSlot.venue !== 'hyperliquid' || activeSlot.id.length === 0) {
      setCancelError('Connect the Hyperliquid wallet for this order before cancelling.');
      return;
    }
    if (
      activeSlot.accountId.trim().toLowerCase() !== action.accountId.trim().toLowerCase() ||
      !action.orderId ||
      !action.venueOrderId
    ) {
      setCancelError('This order cannot be cancelled from the current wallet session.');
      return;
    }

    setCancelError(null);
    markActionCancelStarted({
      actionId: action.id,
      accountId: action.accountId,
      venue: action.venue,
    });

    try {
      const unsignedCancelAction = await buildUnsignedCancelAction({
        cancel: {
          accountId: action.accountId,
          venue: action.venue,
          instrument: action.instrument,
          orderId: action.orderId,
          venueOrderId: action.venueOrderId,
        },
      });
      const signature = await signRuntimeSlotActionPayload({
        slotId: activeSlot.id,
        accountId: activeSlot.accountId,
        payload: unsignedCancelAction.unsignedActionPayload,
      });
      const venueSubmission = await submitSignedAction({
        orderId: unsignedCancelAction.orderId,
        signature,
        unsignedActionPayload: unsignedCancelAction.unsignedActionPayload,
      });

      if (venueSubmission.status.trim().toLowerCase() !== 'submitted') {
        const debugReason =
          typeof venueSubmission.debugReason === 'string' && venueSubmission.debugReason.trim().length
            ? ` ${venueSubmission.debugReason}`
            : '';
        throw new Error(
          `Venue cancellation returned status ${venueSubmission.status}.${debugReason}`,
        );
      }

      markActionCancelSubmitted({
        actionId: action.id,
        accountId: action.accountId,
        venue: action.venue,
        actionHash: venueSubmission.actionHash,
      });
    } catch (error) {
      const message =
        error instanceof TransactionGuardrailError || error instanceof Error
          ? error.message
          : 'Cancel request failed unexpectedly.';

      markActionCancelFailed({
        actionId: action.id,
        accountId: action.accountId,
        venue: action.venue,
        error: message,
      });
      setCancelError(message);
    }
  }

  return (
    <div className="perp-activity-panel">
      <div className="perp-activity-panel-header">
        <div>
          <p className="perp-activity-panel-title">Recent Perp Orders & Fills</p>
          <p className="perp-activity-panel-copy">
            Dedicated workspace block for Hyperliquid and Aster perp activity.
          </p>
        </div>
        <span className="perp-activity-panel-pill">Prototype</span>
      </div>
      {cancelError ? <p className="perp-activity-panel-error">{cancelError}</p> : null}

      <div className="perp-activity-table-shell" aria-label="Perp orders and fills table">
        <div className="perp-activity-table-head">
          <span>Time</span>
          <span>Type</span>
          <span>Instrument</span>
          <span>Side</span>
          <span>Size</span>
          <span>Status</span>
          <span>Venue</span>
          <span>Details</span>
          <span>Action</span>
        </div>

        {rows.length > 0 ? (
          <div className="perp-activity-table-body">
            {rows.map((row) => {
              const cancelAction = row.cancelState === 'available' ? row.action : undefined;

              return (
                <div className="perp-activity-table-row" key={row.rowKey}>
                  <span>{formatTimestamp(row.timestamp)}</span>
                  <span>{row.type}</span>
                  <span>{row.instrument}</span>
                  <span>{row.side}</span>
                  <span>{row.size}</span>
                  <span>
                    <span className={`perp-activity-status ${row.statusClassName}`}>{row.status}</span>
                  </span>
                  <span>{row.venueLabel}</span>
                  <span className="perp-activity-row-details">{row.details}</span>
                  <span>
                    {cancelAction ? (
                      <button
                        className="perp-activity-action-button"
                        onClick={() => void handleCancelAction(cancelAction)}
                        type="button"
                      >
                        Cancel
                      </button>
                    ) : row.cancelState === 'pending' ? (
                      <button
                        aria-busy="true"
                        className="perp-activity-action-button is-pending"
                        disabled
                        type="button"
                      >
                        Cancelling...
                      </button>
                    ) : (
                      <span className="perp-activity-action-copy">
                        not supported by venue/order state
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="perp-activity-empty">
            <p>
              {activeSlot
                ? `No recent perp orders tracked yet for ${getWalletVenueLabel(activeSlot.venue)}.`
                : 'Connect a wallet to start tracking recent perp orders in this block.'}
            </p>
            <p>
              {fillsLoading
                ? 'Loading recent fills...'
                : fillsError
                  ? fillsError
                  : 'No recent fills available for this wallet yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
