'use client';

import type { PerpFill } from '@/lib/market-data/types';
import { buildUnsignedCancelAction } from '@/lib/wallet/build-unsigned-cancel-action';
import { useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

function getStatusVariant(row: ActivityRow) {
  if (row.statusClassName.includes('filled')) {
    return 'success';
  }

  if (
    row.statusClassName.includes('cancelled') ||
    row.statusClassName.includes('rejected') ||
    row.statusClassName.includes('failed')
  ) {
    return 'destructive';
  }

  if (row.statusClassName.includes('reconciling')) {
    return 'warning';
  }

  return 'secondary';
}

export function PerpOrdersFillsPanel() {
  const { activeSlot } = useWalletManager();
  const { actions, markActionCancelFailed, markActionCancelStarted, markActionCancelSubmitted } =
    useSubmittedPerpActionsTracker();
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
          typeof venueSubmission.debugReason === 'string' &&
          venueSubmission.debugReason.trim().length
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
    <div className="flex h-full flex-col gap-4">
      {cancelError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {cancelError}
        </div>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="grid gap-3 md:hidden">
            {rows.map((row) => {
              const cancelAction = row.cancelState === 'available' ? row.action : undefined;

              return (
                <div
                  key={row.rowKey}
                  className="rounded-xl border border-border/70 bg-background/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{row.instrument}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatTimestamp(row.timestamp)}
                      </p>
                    </div>
                    <Badge variant={getStatusVariant(row)}>{row.status}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Type</p>
                      <p className="font-medium text-foreground">{row.type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Side</p>
                      <p className="font-medium text-foreground">{row.side}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Size</p>
                      <p className="font-medium text-foreground">{row.size}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Venue</p>
                      <p className="font-medium text-foreground">{row.venueLabel}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-muted-foreground">{row.details}</p>
                  <div className="mt-4">
                    {cancelAction ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleCancelAction(cancelAction)}
                      >
                        Cancel
                      </Button>
                    ) : row.cancelState === 'pending' ? (
                      <Button type="button" size="sm" variant="outline" disabled>
                        Cancelling...
                      </Button>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Cancellation not supported for this venue or order state.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <ScrollArea className="hidden min-h-0 flex-1 rounded-xl border border-border/70 bg-background/20 md:block">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Time</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Instrument</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const cancelAction = row.cancelState === 'available' ? row.action : undefined;

                  return (
                    <TableRow key={row.rowKey}>
                      <TableCell>{formatTimestamp(row.timestamp)}</TableCell>
                      <TableCell>{row.type}</TableCell>
                      <TableCell className="font-medium text-foreground">
                        {row.instrument}
                      </TableCell>
                      <TableCell>{row.side}</TableCell>
                      <TableCell>{row.size}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(row)}>{row.status}</Badge>
                      </TableCell>
                      <TableCell>{row.venueLabel}</TableCell>
                      <TableCell className="text-muted-foreground">{row.details}</TableCell>
                      <TableCell>
                        {cancelAction ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void handleCancelAction(cancelAction)}
                          >
                            Cancel
                          </Button>
                        ) : row.cancelState === 'pending' ? (
                          <Button type="button" size="sm" variant="outline" disabled>
                            Cancelling...
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not supported</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </>
      ) : (
        <div className="rounded-xl border border-dashed border-border/80 bg-background/40 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">
            {activeSlot
              ? `No recent perp orders tracked yet for ${getWalletVenueLabel(activeSlot.venue)}.`
              : 'Connect a wallet to start tracking recent perp orders in this block.'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {fillsLoading
              ? 'Loading recent fills...'
              : fillsError
                ? fillsError
                : 'No recent fills available for this wallet yet.'}
          </p>
        </div>
      )}
    </div>
  );
}
