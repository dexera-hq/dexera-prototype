'use client';

import type { BffBuildUnsignedActionResponse, BffVenueId } from '@dexera/api-types/openapi';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  SIGNING_ONLY_DISCLAIMER_LINES,
  TransactionGuardrailError,
} from '@/lib/wallet/transaction-guardrails';
import type { ActionSubmissionResult } from '@/lib/wallet/types';
import { isWalletSlotTradable } from '@/lib/wallet/types';
import { useWalletManager } from '@/lib/wallet/wallet-manager-context';

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

function toJsonPreview(value: unknown): string {
  return JSON.stringify(value, null, 2);
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

type OrderEntryPanelProps = {
  marketData: WorkspaceMarketDataState;
  onActionSubmitted?: (receipt: OrderEntrySubmissionReceipt) => void;
};

export function OrderEntryPanel({ marketData, onActionSubmitted }: OrderEntryPanelProps) {
  const { activeSlot } = useWalletManager();
  const canTradeWithActiveWallet = isWalletSlotTradable(activeSlot);
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
                throw new Error(`Venue submission returned status ${venueSubmission.status}.`);
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
      setExecutionState({
        status: 'error',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="order-entry-panel">
      <div className="order-entry-grid">
        <label className="order-entry-field">
          Venue
          <select
            className="order-entry-select"
            value={draft.venue}
            onChange={(event) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                venue: event.target.value as BffVenueId,
              }))
            }
            disabled={isSubmitting}
          >
            {SUPPORTED_VENUES.map((venue) => (
              <option key={venue} value={venue}>
                {getWalletVenueLabel(venue)}
              </option>
            ))}
          </select>
        </label>

        <label className="order-entry-field">
          Instrument
          <select
            className="order-entry-select"
            value={draft.instrument}
            onChange={(event) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                instrument: event.target.value,
              }))
            }
            disabled={isSubmitting || venueInstruments.length === 0}
          >
            {venueInstruments.length > 0 ? (
              venueInstruments.map((instrument) => (
                <option key={instrument} value={instrument}>
                  {instrument}
                </option>
              ))
            ) : (
              <option value="">No instruments available</option>
            )}
          </select>
        </label>
      </div>

      <div className="order-entry-segment-row">
        <div className="order-entry-segment" role="tablist" aria-label="Order side">
          <Button
            type="button"
            size="sm"
            className={draft.side === 'buy' ? 'order-entry-segment-active-buy' : ''}
            variant={draft.side === 'buy' ? 'default' : 'soft'}
            onClick={() => setDraft((currentDraft) => ({ ...currentDraft, side: 'buy' }))}
            disabled={isSubmitting}
          >
            Buy
          </Button>
          <Button
            type="button"
            size="sm"
            className={draft.side === 'sell' ? 'order-entry-segment-active-sell' : ''}
            variant={draft.side === 'sell' ? 'default' : 'soft'}
            onClick={() => setDraft((currentDraft) => ({ ...currentDraft, side: 'sell' }))}
            disabled={isSubmitting}
          >
            Sell
          </Button>
        </div>

        <div className="order-entry-segment" role="tablist" aria-label="Order type">
          <Button
            type="button"
            size="sm"
            variant={draft.type === 'market' ? 'default' : 'soft'}
            className={draft.type === 'market' ? 'order-entry-segment-active-type' : ''}
            onClick={() =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                type: 'market',
              }))
            }
            disabled={isSubmitting}
          >
            Market
          </Button>
          <Button
            type="button"
            size="sm"
            variant={draft.type === 'limit' ? 'default' : 'soft'}
            className={draft.type === 'limit' ? 'order-entry-segment-active-type' : ''}
            onClick={() =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                type: 'limit',
                limitPrice:
                  currentDraft.limitPrice.trim().length > 0 || markPrice === undefined
                    ? currentDraft.limitPrice
                    : markPrice.toFixed(2),
              }))
            }
            disabled={isSubmitting}
          >
            Limit
          </Button>
        </div>
      </div>

      <div className="order-entry-grid">
        <label className="order-entry-field">
          Size
          <Input
            value={draft.size}
            onChange={(event) =>
              setDraft((currentDraft) => ({ ...currentDraft, size: event.target.value }))
            }
            disabled={isSubmitting}
            inputMode="decimal"
            placeholder="0.10"
          />
        </label>

        <label className="order-entry-field">
          Leverage (optional)
          <Input
            value={draft.leverage}
            onChange={(event) =>
              setDraft((currentDraft) => ({ ...currentDraft, leverage: event.target.value }))
            }
            disabled={isSubmitting}
            inputMode="decimal"
            placeholder="5"
          />
        </label>
      </div>

      {draft.type === 'limit' ? (
        <label className="order-entry-field">
          Limit Price
          <Input
            value={draft.limitPrice}
            onChange={(event) =>
              setDraft((currentDraft) => ({ ...currentDraft, limitPrice: event.target.value }))
            }
            disabled={isSubmitting}
            inputMode="decimal"
            placeholder={markPrice?.toFixed(2) ?? '0.00'}
          />
        </label>
      ) : null}

      <label className="order-entry-checkbox">
        <input
          type="checkbox"
          checked={draft.reduceOnly}
          onChange={(event) =>
            setDraft((currentDraft) => ({ ...currentDraft, reduceOnly: event.target.checked }))
          }
          disabled={isSubmitting}
        />
        <span>Reduce-only</span>
      </label>

      <div className="order-entry-summary">
        <div className="order-entry-summary-row">
          <span>Active Wallet</span>
          <strong>{activeWalletLabel}</strong>
        </div>
        <div className="order-entry-summary-row">
          <span>Selected Venue</span>
          <strong>{getWalletVenueLabel(draft.venue)}</strong>
        </div>
      </div>

      <div className="order-entry-actions">
        <Button
          type="button"
          variant="soft"
          onClick={() => void handlePreviewUnsignedPayload()}
          disabled={!canPreview}
        >
          {isSubmitting ? 'Building Preview...' : 'Preview Unsigned Payload'}
        </Button>
        <Button type="button" onClick={() => void handleSubmitInWallet()} disabled={!canSubmit}>
          {isSubmitting ? 'Waiting for Wallet...' : 'Submit in Wallet'}
        </Button>
      </div>

      <div
        className={`order-entry-state order-entry-state-${executionState.status}`}
        role="status"
        aria-live="polite"
      >
        <p className="order-entry-state-title">
          {executionState.status === 'success' ? 'Ready' : 'Order Entry Status'}
        </p>
        <p className="order-entry-state-message">{executionState.message}</p>
        {latestSubmission ? (
          <p className="order-entry-state-message">
            Last submission: order {latestSubmission.orderId} / hash {latestSubmission.actionHash}
            {latestSubmission.venueOrderId ? ` / venue order ${latestSubmission.venueOrderId}` : ''}
            .
          </p>
        ) : null}
        {previewBlockingMessage ? (
          <p className="order-entry-blocking-message">{previewBlockingMessage}</p>
        ) : null}
      </div>

      <div className="order-entry-preview">
        <div className="order-entry-preview-header">
          <p>Unsigned Action Payload</p>
          <span
            className={
              isPreviewDirty ? 'order-entry-preview-pill stale' : 'order-entry-preview-pill'
            }
          >
            {previewResponse === null ? 'Missing' : isPreviewDirty ? 'Stale' : 'Current'}
          </span>
        </div>

        {previewResponse ? (
          <>
            <div className="order-entry-preview-meta">
              <span>Order ID: {previewResponse.orderId}</span>
              <span>Policy: {previewResponse.signingPolicy}</span>
            </div>
            <p className="order-entry-preview-disclaimer">{previewResponse.disclaimer}</p>
            <pre className="order-entry-json">
              {toJsonPreview(previewResponse.unsignedActionPayload)}
            </pre>
          </>
        ) : (
          <p className="order-entry-preview-empty">
            Build a preview to inspect the unsigned action payload before signing.
          </p>
        )}
      </div>

      <div className="order-entry-guardrails">
        <p className="order-entry-guardrails-title">Signing Guardrails</p>
        <ul className="order-entry-guardrails-list">
          {SIGNING_ONLY_DISCLAIMER_LINES.map((line) => (
            <li key={line}>{line}</li>
          ))}
          <li>No API key or server-side signing path is used in this order entry flow.</li>
        </ul>
      </div>
    </div>
  );
}
