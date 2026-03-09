'use client';

import type { PerpFill } from '@/lib/market-data/types';
import { useEffect, useMemo, useState } from 'react';
import { getPerpFills } from '@/lib/market-data/get-perp-fills';
import { getWalletVenueLabel } from '@/lib/wallet/chains';
import {
  formatTrackedPerpActionStatusLabel,
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
  };
}

export function PerpOrdersFillsPanel() {
  const { activeSlot } = useWalletManager();
  const { actions } = useSubmittedPerpActionsTracker();
  const [fills, setFills] = useState<PerpFill[]>([]);
  const [fillsLoading, setFillsLoading] = useState(false);
  const [fillsError, setFillsError] = useState<string | null>(null);

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
        </div>

        {rows.length > 0 ? (
          <div className="perp-activity-table-body">
            {rows.map((row) => (
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
              </div>
            ))}
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
