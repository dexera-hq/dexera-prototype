'use client';

import type { BffBuildUnsignedActionResponse, BffVenueId } from '@dexera/api-types/openapi';
import { ArrowRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { WorkspaceMarketDataState } from '@/components/workspace/use-workspace-market-data';
import { buildUnsignedAction } from '@/lib/wallet/build-unsigned-transaction';
import { getWalletVenueLabel, SUPPORTED_VENUES } from '@/lib/wallet/chains';
import {
  signAndSubmitRuntimeSlotAction,
  signRuntimeSlotActionPayload,
} from '@/lib/wallet/multi-session-runtime';
import {
  buildPerpOrderRequest,
  canSubmitOrderEntry,
  createOrderEntryDraft,
  createOrderPreviewKey,
  isVenueMismatched,
  type OrderEntryDraft,
  validateOrderEntryDraft,
} from '@/lib/wallet/order-entry-logic';
import {
  collectOrderEntryInstruments,
  resolveLimitPriceAutofill,
} from '@/lib/wallet/order-entry-panel-state';
import { submitUnsignedAction } from '@/lib/wallet/sign-unsigned-transaction';
import { submitSignedAction } from '@/lib/wallet/submit-signed-action';
import { TransactionGuardrailError } from '@/lib/wallet/transaction-guardrails';
import type { ActionSubmissionResult } from '@/lib/wallet/types';
import { isWalletSlotTradable } from '@/lib/wallet/types';
import { useSubmittedPerpActionsTracker } from '@/lib/wallet/use-submitted-perp-actions';
import { useWalletManager } from '@/lib/wallet/wallet-manager-context';
import { cn } from '@/lib/utils';

type OrderEntryExecutionState =
  | { status: 'idle'; message: string }
  | { status: 'pending'; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

type OrderEntrySubmissionReceipt = ActionSubmissionResult & {
  submittedAt: string;
};

function truncateAccountId(accountId: string): string {
  if (accountId.length <= 14) {
    return accountId;
  }

  return `${accountId.slice(0, 8)}...${accountId.slice(-4)}`;
}

function getWalletBlockingMessage(parameters: {
  hasActiveWallet: boolean;
  canTradeWithActiveWallet: boolean;
  venueMismatch: boolean;
  selectedVenue: BffVenueId;
  activeWalletVenue: BffVenueId | null;
  eligibilityReason?: string;
}): string | null {
  if (!parameters.hasActiveWallet) {
    return 'Connect and verify a wallet to preview and sign orders.';
  }

  if (!parameters.canTradeWithActiveWallet) {
    return (
      parameters.eligibilityReason ??
      'Active wallet is not eligible to trade. Reconnect and complete verification.'
    );
  }

  if (parameters.venueMismatch) {
    const selectedVenueLabel = getWalletVenueLabel(parameters.selectedVenue);
    const walletVenueLabel = parameters.activeWalletVenue
      ? getWalletVenueLabel(parameters.activeWalletVenue)
      : 'Unknown';
    return `Selected venue ${selectedVenueLabel} does not match active wallet venue ${walletVenueLabel}.`;
  }

  return null;
}

function getExecutionTone(status: OrderEntryExecutionState['status']) {
  if (status === 'success') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';
  }

  if (status === 'error') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-100';
  }

  if (status === 'pending') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-100';
  }

  return 'border-border/80 bg-background/40 text-foreground';
}

type OrderEntryPanelProps = {
  marketData: WorkspaceMarketDataState;
  onActionSubmitted?: (receipt: OrderEntrySubmissionReceipt) => void;
};

export function OrderEntryPanel({ marketData, onActionSubmitted }: OrderEntryPanelProps) {
  const { activeSlot } = useWalletManager();
  const canTradeWithActiveWallet = isWalletSlotTradable(activeSlot);
  const { addOptimisticAction, markActionSubmitted, markActionFailed } =
    useSubmittedPerpActionsTracker();
  const [draft, setDraft] = useState<OrderEntryDraft>(() =>
    createOrderEntryDraft({ venue: activeSlot?.venue ?? 'hyperliquid' }),
  );
  const [previewResponse, setPreviewResponse] = useState<BffBuildUnsignedActionResponse | null>(
    null,
  );
  const [previewKey, setPreviewKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [executionState, setExecutionState] = useState<OrderEntryExecutionState>({
    status: 'idle',
    message: 'Preview an unsigned payload before wallet submission.',
  });
  const [latestSubmission, setLatestSubmission] = useState<OrderEntrySubmissionReceipt | null>(
    null,
  );
  const lastSyncedLimitInstrumentRef = useRef<string>(draft.instrument);

  const venueInstruments = useMemo(
    () => collectOrderEntryInstruments(marketData.instruments, draft.venue),
    [marketData.instruments, draft.venue],
  );

  useEffect(() => {
    if (venueInstruments.length === 0) {
      setDraft((currentDraft) =>
        currentDraft.instrument.length === 0 ? currentDraft : { ...currentDraft, instrument: '' },
      );
      return;
    }

    const normalizedInstrument = draft.instrument.trim().toUpperCase();
    if (venueInstruments.includes(normalizedInstrument)) {
      return;
    }

    setDraft((currentDraft) => ({
      ...currentDraft,
      instrument: venueInstruments[0] ?? '',
    }));
  }, [draft.instrument, venueInstruments]);

  const markPrice = draft.instrument
    ? marketData.marks[draft.instrument.toUpperCase()]?.price
    : undefined;

  useEffect(() => {
    const nextAutofill = resolveLimitPriceAutofill({
      orderType: draft.type,
      instrument: draft.instrument,
      currentLimitPrice: draft.limitPrice,
      markPrice,
      lastSyncedInstrument: lastSyncedLimitInstrumentRef.current,
    });

    if (nextAutofill === null) {
      return;
    }

    lastSyncedLimitInstrumentRef.current = nextAutofill.nextSyncedInstrument;
    setDraft((currentDraft) =>
      currentDraft.limitPrice === nextAutofill.nextLimitPrice
        ? currentDraft
        : { ...currentDraft, limitPrice: nextAutofill.nextLimitPrice },
    );
  }, [draft.instrument, draft.limitPrice, draft.type, markPrice]);

  const validation = useMemo(() => validateOrderEntryDraft(draft), [draft]);

  const venueMismatch = isVenueMismatched(draft.venue, activeSlot?.venue ?? null);
  const walletBlockingMessage = getWalletBlockingMessage({
    hasActiveWallet: Boolean(activeSlot),
    canTradeWithActiveWallet,
    venueMismatch,
    selectedVenue: draft.venue,
    activeWalletVenue: activeSlot?.venue ?? null,
    eligibilityReason: activeSlot?.eligibilityReason,
  });

  const previewBlockingMessage =
    walletBlockingMessage ?? (validation.ok ? null : validation.message);

  const orderRequest = useMemo(() => {
    if (!activeSlot || !validation.ok) {
      return null;
    }

    return buildPerpOrderRequest({
      draft,
      accountId: activeSlot.accountId,
    });
  }, [activeSlot, draft, validation.ok]);

  const currentPreviewKey = useMemo(
    () => (orderRequest ? createOrderPreviewKey(orderRequest) : null),
    [orderRequest],
  );
  const isPreviewDirty =
    previewResponse !== null && (currentPreviewKey === null || currentPreviewKey !== previewKey);

  const canPreview = !isSubmitting && previewBlockingMessage === null && orderRequest !== null;
  const canSubmit = canSubmitOrderEntry({
    isSubmitting,
    hasTradableWallet: canTradeWithActiveWallet,
    venueMatchesWallet: !venueMismatch,
    hasPreview: previewResponse !== null,
    isPreviewDirty,
  });

  const activeWalletLabel = useMemo(() => {
    if (!activeSlot) {
      return 'No wallet connected';
    }

    return `${truncateAccountId(activeSlot.accountId)} · ${getWalletVenueLabel(activeSlot.venue)}`;
  }, [activeSlot]);

  async function handlePreviewUnsignedPayload() {
    if (!activeSlot || !orderRequest) {
      setExecutionState({
        status: 'error',
        message: 'Connect and verify a tradable wallet before previewing.',
      });
      return;
    }

    if (previewBlockingMessage) {
      setExecutionState({
        status: 'error',
        message: previewBlockingMessage,
      });
      return;
    }

    setIsSubmitting(true);
    setExecutionState({
      status: 'pending',
      message: 'Building unsigned action payload from the selected order inputs...',
    });

    try {
      const response = await buildUnsignedAction({ order: orderRequest });
      setPreviewResponse(response);
      setPreviewKey(createOrderPreviewKey(orderRequest));
      setExecutionState({
        status: 'success',
        message: `Unsigned payload ${response.unsignedActionPayload.id} is ready for wallet signing.`,
      });
    } catch (error) {
      const message =
        error instanceof TransactionGuardrailError || error instanceof Error
          ? error.message
          : 'Failed to preview unsigned action payload.';
      setExecutionState({
        status: 'error',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitInWallet() {
    if (!activeSlot || !previewResponse) {
      setExecutionState({
        status: 'error',
        message: 'Preview a current unsigned payload before submitting in wallet.',
      });
      return;
    }

    if (!canSubmit) {
      const blockedReason =
        walletBlockingMessage ??
        (isPreviewDirty
          ? 'Order fields changed since the last preview. Refresh the unsigned payload first.'
          : 'Preview a current unsigned payload before submitting in wallet.');
      setExecutionState({
        status: 'error',
        message: blockedReason,
      });
      return;
    }

    setIsSubmitting(true);
    setExecutionState({
      status: 'pending',
      message:
        activeSlot.venue === 'hyperliquid'
          ? 'Awaiting wallet signature for Hyperliquid action...'
          : 'Submitting unsigned payload to the connected wallet runtime...',
    });
    const optimisticActionId =
      activeSlot.venue === 'hyperliquid'
        ? addOptimisticAction({
            accountId: activeSlot.accountId,
            venue: activeSlot.venue,
            instrument: draft.instrument,
            side: draft.side,
            type: draft.type,
            size: draft.size,
            limitPrice: draft.type === 'limit' ? draft.limitPrice : undefined,
            orderId: previewResponse.orderId,
          })
        : null;

    try {
      const submission =
        activeSlot.venue === 'hyperliquid'
          ? await (async () => {
              const signature = await signRuntimeSlotActionPayload({
                slotId: activeSlot.id,
                accountId: activeSlot.accountId,
                payload: previewResponse.unsignedActionPayload,
              });

              setExecutionState({
                status: 'pending',
                message: 'Submitting signed Hyperliquid action to venue...',
              });

              const venueSubmission = await submitSignedAction({
                orderId: previewResponse.orderId,
                signature,
                unsignedActionPayload: previewResponse.unsignedActionPayload,
              });

              if (venueSubmission.status.trim().toLowerCase() !== 'submitted') {
                const debugReason =
                  typeof venueSubmission.debugReason === 'string' &&
                  venueSubmission.debugReason.trim().length > 0
                    ? ` ${venueSubmission.debugReason}`
                    : '';
                throw new Error(
                  `Venue submission returned status ${venueSubmission.status}.${debugReason}`,
                );
              }

              return {
                orderId: venueSubmission.orderId,
                actionHash: venueSubmission.actionHash,
                unsignedActionPayloadId: previewResponse.unsignedActionPayload.id,
                accountId: activeSlot.accountId,
                venue: activeSlot.venue,
                venueOrderId: venueSubmission.venueOrderId,
              } satisfies ActionSubmissionResult;
            })()
          : await submitUnsignedAction({
              orderId: previewResponse.orderId,
              payload: previewResponse.unsignedActionPayload,
              activeWallet: activeSlot,
              submitter: {
                sendAction: async ({ accountId, payload }) => ({
                  actionHash: await signAndSubmitRuntimeSlotAction({
                    slotId: activeSlot.id,
                    accountId,
                    payload,
                  }),
                }),
              },
            });
      const receipt: OrderEntrySubmissionReceipt = {
        ...submission,
        submittedAt: new Date().toISOString(),
      };

      if (activeSlot.venue === 'hyperliquid' && optimisticActionId) {
        markActionSubmitted({
          actionId: optimisticActionId,
          accountId: activeSlot.accountId,
          venue: activeSlot.venue,
          orderId: submission.orderId,
          actionHash: submission.actionHash,
          venueOrderId: submission.venueOrderId,
        });
      }

      setLatestSubmission(receipt);
      onActionSubmitted?.(receipt);

      setExecutionState({
        status: 'success',
        message:
          submission.venueOrderId && submission.venueOrderId.trim().length > 0
            ? `Submitted order ${submission.orderId} with action hash ${submission.actionHash} (venue order ${submission.venueOrderId}).`
            : `Submitted order ${submission.orderId} with action hash ${submission.actionHash}.`,
      });
    } catch (error) {
      const message =
        error instanceof TransactionGuardrailError || error instanceof Error
          ? error.message
          : 'Wallet submission failed unexpectedly.';

      if (activeSlot.venue === 'hyperliquid' && optimisticActionId) {
        markActionFailed({
          actionId: optimisticActionId,
          accountId: activeSlot.accountId,
          venue: activeSlot.venue,
          error: message,
        });
      }

      setExecutionState({
        status: 'error',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Venue</label>
          <Select
            value={draft.venue}
            onValueChange={(value) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                venue: value as BffVenueId,
              }))
            }
            disabled={isSubmitting}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select venue" />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_VENUES.map((venue) => (
                <SelectItem key={venue} value={venue}>
                  {getWalletVenueLabel(venue)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Instrument</label>
          <Select
            value={draft.instrument}
            onValueChange={(value) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                instrument: value,
              }))
            }
            disabled={isSubmitting || venueInstruments.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select instrument" />
            </SelectTrigger>
            <SelectContent>
              {venueInstruments.length > 0 ? (
                venueInstruments.map((instrument) => (
                  <SelectItem key={instrument} value={instrument}>
                    {instrument}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="__empty" disabled>
                  No instruments available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Side</label>
          <Tabs
            value={draft.side}
            onValueChange={(value) =>
              setDraft((currentDraft) => ({ ...currentDraft, side: value as 'buy' | 'sell' }))
            }
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="buy">Buy</TabsTrigger>
              <TabsTrigger value="sell">Sell</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Order type</label>
          <Tabs
            value={draft.type}
            onValueChange={(value) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                type: value as 'market' | 'limit',
                limitPrice:
                  value === 'limit' &&
                  currentDraft.limitPrice.trim().length === 0 &&
                  markPrice !== undefined
                    ? markPrice.toFixed(2)
                    : currentDraft.limitPrice,
              }))
            }
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="market">Market</TabsTrigger>
              <TabsTrigger value="limit">Limit</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Size</label>
          <Input
            value={draft.size}
            onChange={(event) =>
              setDraft((currentDraft) => ({ ...currentDraft, size: event.target.value }))
            }
            disabled={isSubmitting}
            inputMode="decimal"
            placeholder="0.10"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Leverage (optional)</label>
          <Input
            value={draft.leverage}
            onChange={(event) =>
              setDraft((currentDraft) => ({ ...currentDraft, leverage: event.target.value }))
            }
            disabled={isSubmitting}
            inputMode="decimal"
            placeholder="5"
          />
        </div>
      </div>

      {draft.type === 'limit' ? (
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Limit price</label>
          <Input
            value={draft.limitPrice}
            onChange={(event) =>
              setDraft((currentDraft) => ({ ...currentDraft, limitPrice: event.target.value }))
            }
            disabled={isSubmitting}
            inputMode="decimal"
            placeholder={markPrice?.toFixed(2) ?? '0.00'}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-background/40 px-4 py-3">
        <Checkbox
          id="reduce-only"
          checked={draft.reduceOnly}
          onCheckedChange={(checked) =>
            setDraft((currentDraft) => ({ ...currentDraft, reduceOnly: checked === true }))
          }
          disabled={isSubmitting}
        />
        <label htmlFor="reduce-only" className="text-sm font-medium text-foreground">
          Reduce-only
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-background/40 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Active wallet</p>
          <p className="mt-2 text-sm font-medium text-foreground">{activeWalletLabel}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/40 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Selected venue</p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {getWalletVenueLabel(draft.venue)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handlePreviewUnsignedPayload()}
          disabled={!canPreview}
        >
          {isSubmitting ? 'Building Preview...' : 'Preview Unsigned Payload'}
        </Button>
        <Button type="button" onClick={() => void handleSubmitInWallet()} disabled={!canSubmit}>
          {isSubmitting ? 'Waiting for Wallet...' : 'Submit in Wallet'}
          {!isSubmitting ? <ArrowRight className="size-4" /> : null}
        </Button>
      </div>

      <div
        className={cn('rounded-xl border px-4 py-4', getExecutionTone(executionState.status))}
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">
            {executionState.status === 'success' ? 'Ready to submit' : 'Order entry status'}
          </p>
          <Badge
            variant={previewResponse === null ? 'outline' : isPreviewDirty ? 'warning' : 'success'}
          >
            {previewResponse === null
              ? 'Preview missing'
              : isPreviewDirty
                ? 'Preview stale'
                : 'Preview current'}
          </Badge>
        </div>
        <p className="mt-2 text-sm leading-6">{executionState.message}</p>
        {latestSubmission ? (
          <p className="mt-2 text-sm leading-6">
            Last submission: order {latestSubmission.orderId} / hash {latestSubmission.actionHash}
            {latestSubmission.venueOrderId ? ` / venue order ${latestSubmission.venueOrderId}` : ''}
            .
          </p>
        ) : null}
        {previewBlockingMessage ? (
          <p className="mt-2 text-sm leading-6">{previewBlockingMessage}</p>
        ) : null}
      </div>

    </div>
  );
}
