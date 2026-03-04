'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WorkspaceMarketDataState } from '@/components/workspace/use-workspace-market-data';
import type { WorkspaceModule } from '@/components/workspace/types';
import { buildUnsignedAction } from '@/lib/wallet/build-unsigned-transaction';
import { getWalletVenueLabel } from '@/lib/wallet/chains';
import { signAndSubmitRuntimeSlotAction } from '@/lib/wallet/multi-session-runtime';
import { isWalletSlotTradable } from '@/lib/wallet/types';
import { useWalletManager } from '@/lib/wallet/wallet-manager-context';
import { submitUnsignedAction } from '@/lib/wallet/sign-unsigned-transaction';
import {
  SIGNING_ONLY_DISCLAIMER_LINES,
  TransactionGuardrailError,
} from '@/lib/wallet/transaction-guardrails';

type TradeExecutionState =
  | { status: 'idle'; message: string }
  | { status: 'pending'; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

function truncateAccountId(accountId: string): string {
  if (accountId.length <= 14) {
    return accountId;
  }

  return `${accountId.slice(0, 8)}...${accountId.slice(-4)}`;
}

function formatUsd(value: string): string {
  const normalizedValue = Number(value);

  if (!Number.isFinite(normalizedValue)) {
    return `$${value}`;
  }

  return `$${normalizedValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function resolveTradeInstrument(marketData: WorkspaceMarketDataState): string {
  const preferred = marketData.instruments.find(
    (instrument) => instrument.instrument === 'ETH-PERP',
  );
  if (preferred) {
    return preferred.instrument;
  }

  return marketData.instruments[0]?.instrument ?? 'ETH-PERP';
}

function TradePanel({ marketData }: { marketData: WorkspaceMarketDataState }) {
  const { activeSlot } = useWalletManager();
  const instrument = resolveTradeInstrument(marketData);
  const mark = marketData.marks[instrument];

  const [price, setPrice] = useState(() => (mark ? mark.price.toFixed(2) : '0.00'));
  const [size, setSize] = useState('0.10');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [executionState, setExecutionState] = useState<TradeExecutionState>({
    status: 'idle',
    message:
      'Server-built unsigned action validation is available from the trade confirmation modal.',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidationToast, setShowValidationToast] = useState(false);
  const canTradeWithActiveWallet = isWalletSlotTradable(activeSlot);

  const activeWalletLabel = useMemo(() => {
    if (!activeSlot) {
      return 'No wallet connected';
    }

    return `${truncateAccountId(activeSlot.accountId)} · ${getWalletVenueLabel(activeSlot.venue)}`;
  }, [activeSlot]);

  useEffect(() => {
    if (!isConfirmOpen) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        setIsConfirmOpen(false);
      }
    }

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isConfirmOpen, isSubmitting]);

  useEffect(() => {
    if (!showValidationToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowValidationToast(false);
    }, 3600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showValidationToast]);

  useEffect(() => {
    if (mark) {
      setPrice(mark.price.toFixed(2));
    }
  }, [mark]);

  const handleTradeSubmit = async () => {
    if (!activeSlot) {
      setExecutionState({
        status: 'error',
        message: 'Connect a wallet to run the unsigned-build and client-signing checks.',
      });
      return;
    }
    if (!canTradeWithActiveWallet) {
      const reason =
        activeSlot.eligibilityReason ?? 'Connected wallet is not eligible to trade on this venue.';
      setExecutionState({
        status: 'error',
        message: reason,
      });
      return;
    }

    setIsSubmitting(true);
    setExecutionState({
      status: 'pending',
      message:
        'Requesting an unsigned action from the server and running client-side signing checks...',
    });

    try {
      const response = await buildUnsignedAction({
        order: {
          accountId: activeSlot.accountId,
          venue: activeSlot.venue,
          instrument,
          side: 'buy',
          type: 'limit',
          size: size.trim() || '0.10',
          limitPrice: price.trim() || (mark ? mark.price.toFixed(2) : '0.00'),
        },
      });

      const submission = await submitUnsignedAction({
        payload: response.unsignedActionPayload,
        activeWallet: activeSlot,
        submitter: {
          sendAction: async ({ accountId, payload }) =>
            signAndSubmitRuntimeSlotAction({
              slotId: activeSlot.id,
              accountId,
              payload,
            }),
        },
      });

      setExecutionState({
        status: 'success',
        message: `Wallet submitted action ${submission.actionHash} for ${submission.accountId} on ${submission.venue}. Unsigned payload ${submission.unsignedActionPayloadId} passed client-side validation before submission.`,
      });
      setIsConfirmOpen(false);
      setShowValidationToast(true);
    } catch (error) {
      const message =
        error instanceof TransactionGuardrailError || error instanceof Error
          ? error.message
          : 'Perp action signing demo failed unexpectedly.';

      setExecutionState({
        status: 'error',
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="trade-panel">
      <div className="trade-switch" role="tablist" aria-label="Trade mode">
        <Button type="button" size="sm" className="trade-switch-active">
          Buy
        </Button>
        <Button type="button" variant="soft" size="sm">
          Sell
        </Button>
      </div>
      <label>
        Limit Price
        <Input value={price} onChange={(event) => setPrice(event.target.value)} />
      </label>
      <label>
        Size ({instrument})
        <Input value={size} onChange={(event) => setSize(event.target.value)} />
      </label>
      <div className="quick-split" role="group" aria-label="Size presets">
        <Button type="button" variant="soft" size="sm" onClick={() => setSize('0.10')}>
          0.10
        </Button>
        <Button type="button" variant="soft" size="sm" onClick={() => setSize('0.25')}>
          0.25
        </Button>
        <Button type="button" variant="soft" size="sm" onClick={() => setSize('0.50')}>
          0.50
        </Button>
        <Button type="button" variant="soft" size="sm" onClick={() => setSize('1.00')}>
          1.00
        </Button>
      </div>
      <Button
        type="button"
        className="trade-submit"
        onClick={() => setIsConfirmOpen(true)}
        disabled={isSubmitting || !canTradeWithActiveWallet}
      >
        Review and Submit {instrument}
      </Button>

      {executionState.status !== 'idle' ? (
        <div
          className={`trade-execution-state trade-execution-state-${executionState.status}`}
          role="status"
          aria-live="polite"
        >
          <p className="trade-execution-title">
            {executionState.status === 'success' ? 'Signing complete' : 'Signing status'}
          </p>
          <p className="trade-execution-message">{executionState.message}</p>
        </div>
      ) : null}

      {isConfirmOpen ? (
        <div
          className="trade-modal-backdrop"
          role="presentation"
          onClick={() => !isSubmitting && setIsConfirmOpen(false)}
        >
          <div
            className="trade-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="trade-signing-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="trade-modal-header">
              <div>
                <p className="trade-modal-eyebrow">Trade confirmation</p>
                <h3 id="trade-signing-title" className="trade-modal-title">
                  Review signing details
                </h3>
                <p className="trade-modal-subtitle">
                  Confirm the unsigned action inputs before the wallet signs locally.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="trade-modal-close"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSubmitting}
                aria-label="Close signing preview"
              >
                &#10005;
              </Button>
            </div>

            <div className="trade-modal-summary">
              <div className="trade-summary-row">
                <span>Account</span>
                <strong>{activeWalletLabel}</strong>
              </div>
              <div className="trade-summary-row">
                <span>Instrument</span>
                <strong>{instrument}</strong>
              </div>
              <div className="trade-summary-row">
                <span>Limit price</span>
                <strong>{formatUsd(price || (mark ? mark.price.toFixed(2) : '0.00'))}</strong>
              </div>
              <div className="trade-summary-row">
                <span>Size</span>
                <strong>{size || '0.10'}</strong>
              </div>
              <div className="trade-summary-row">
                <span>Estimated notional</span>
                <strong>
                  {formatUsd(
                    String(
                      (Number(price || (mark ? mark.price.toFixed(2) : '0.00')) || 0) *
                        (Number(size || '0.10') || 0),
                    ),
                  )}
                </strong>
              </div>
            </div>

            <div className="trade-modal-guardrails">
              <p className="trade-modal-section-title">Signing guardrails</p>
              <ul className="trade-disclaimer-list">
                {SIGNING_ONLY_DISCLAIMER_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
                <li>
                  Unsigned action payload is fetched from the backend endpoint before wallet
                  submission.
                </li>
              </ul>
            </div>

            <div className="trade-modal-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleTradeSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Waiting for wallet...' : 'Confirm and Submit in Wallet'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showValidationToast ? (
        <div className="trade-validation-toast" role="status" aria-live="polite">
          <div className="trade-validation-toast-icon" aria-hidden="true">
            ✓
          </div>
          <div className="trade-validation-toast-copy">
            <p className="trade-validation-toast-title">Validation passed</p>
            <p className="trade-validation-toast-message">
              Account binding, venue match, and unsigned-action checks all passed before wallet
              submission.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const DEFAULT_INSTRUMENT_ORDER = ['BTC-PERP', 'ETH-PERP', 'SOL-PERP'];

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUSD(value: number): string {
  return USD_FORMATTER.format(value);
}

function metricPill(
  key: string,
  instrument: string,
  price: string,
  delta: string,
  positive: boolean,
) {
  return (
    <li className="ticker-pill" key={key}>
      <span>{instrument}</span>
      <strong>{price}</strong>
      <em className={positive ? 'up' : 'down'}>{delta}</em>
    </li>
  );
}

function deterministicDelta(symbol: string): { label: string; positive: boolean } {
  const seed = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const delta = ((seed % 700) - 350) / 100;
  const positive = delta >= 0;
  const label = `${positive ? '+' : ''}${delta.toFixed(2)}%`;
  return { label, positive };
}

function resolveOverviewInstruments(marketData: WorkspaceMarketDataState): string[] {
  if (marketData.instruments.length > 0) {
    return marketData.instruments
      .slice(0, 4)
      .map((instrument) => instrument.instrument.toUpperCase());
  }
  return DEFAULT_INSTRUMENT_ORDER;
}

function parseNumeric(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function renderMarketDataError(error: string | null) {
  if (!error) {
    return null;
  }
  return <p className="placeholder-text">{error}</p>;
}

type ModuleContentProps = {
  module: WorkspaceModule;
  marketData: WorkspaceMarketDataState;
};

export function ModuleContent({ module, marketData }: ModuleContentProps) {
  const instrumentById = new Map(
    marketData.instruments.map(
      (instrument) => [instrument.instrument.toUpperCase(), instrument] as const,
    ),
  );

  if (module.kind === 'overview') {
    const overviewInstruments = resolveOverviewInstruments(marketData);
    return (
      <>
        {renderMarketDataError(marketData.error)}
        <ul className="ticker-row">
          {overviewInstruments.map((instrument) => {
            const mark = marketData.marks[instrument];
            const delta = deterministicDelta(instrument);
            return metricPill(
              instrument,
              instrument,
              mark ? formatUSD(mark.price) : '--',
              delta.label,
              delta.positive,
            );
          })}
        </ul>
      </>
    );
  }

  if (module.kind === 'chart') {
    const instrument = resolveTradeInstrument(marketData);
    const mark = marketData.marks[instrument];
    const delta = deterministicDelta(instrument);

    return (
      <>
        {renderMarketDataError(marketData.error)}
        <div className="chart-wrap">
          <div className="chart-meta">
            <p className="pair">{instrument}</p>
            <p className="price">{mark ? formatUSD(mark.price) : '--'}</p>
            <p className={`delta ${delta.positive ? 'up' : 'down'}`}>{delta.label}</p>
          </div>
          <div className="chart-frame">
            <svg viewBox="0 0 800 280" aria-hidden="true">
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(19, 201, 145, 0.36)" />
                  <stop offset="100%" stopColor="rgba(19, 201, 145, 0)" />
                </linearGradient>
              </defs>
              <path
                d="M0 250 C80 225, 130 210, 190 205 C260 200, 315 215, 370 190 C430 160, 500 120, 570 125 C640 130, 700 150, 800 70"
                fill="none"
                stroke="#13c991"
                strokeWidth="3"
              />
              <path
                d="M0 250 C80 225, 130 210, 190 205 C260 200, 315 215, 370 190 C430 160, 500 120, 570 125 C640 130, 700 150, 800 70 L800 280 L0 280 Z"
                fill="url(#chartFill)"
              />
            </svg>
          </div>
        </div>
      </>
    );
  }

  if (module.kind === 'trade') {
    return (
      <>
        {renderMarketDataError(marketData.error)}
        <TradePanel marketData={marketData} />
      </>
    );
  }

  if (module.kind === 'orderbook') {
    const instrument = resolveTradeInstrument(marketData);
    const mid = marketData.marks[instrument]?.price ?? 3200;
    const bid = mid - 0.7;
    const ask = mid + 0.7;

    return (
      <>
        {renderMarketDataError(marketData.error)}
        <div className="orderbook">
          <div className="orderbook-row sell">
            <span>{ask.toFixed(2)}</span>
            <span>2.458</span>
            <span>{(ask * 2.458).toFixed(2)}</span>
          </div>
          <div className="orderbook-row sell">
            <span>{(ask + 0.4).toFixed(2)}</span>
            <span>1.192</span>
            <span>{((ask + 0.4) * 1.192).toFixed(2)}</span>
          </div>
          <p className="spread">Spread: {(ask - bid).toFixed(2)}</p>
          <div className="orderbook-row buy">
            <span>{bid.toFixed(2)}</span>
            <span>1.567</span>
            <span>{(bid * 1.567).toFixed(2)}</span>
          </div>
          <div className="orderbook-row buy">
            <span>{(bid - 0.4).toFixed(2)}</span>
            <span>2.204</span>
            <span>{((bid - 0.4) * 2.204).toFixed(2)}</span>
          </div>
        </div>
      </>
    );
  }

  if (module.kind === 'positions') {
    const positions = marketData.positions;
    const totalValue = positions.reduce(
      (sum, position) => sum + parseNumeric(position.notionalValue),
      0,
    );

    return (
      <div className="positions">
        {renderMarketDataError(marketData.error)}
        <div className="positions-pnl">
          TOTAL NOTIONAL: <strong>{formatUSD(totalValue)}</strong>
        </div>
        <div className="positions-grid positions-head">
          <span>Instrument</span>
          <span>Direction</span>
          <span>Size</span>
          <span>Entry</span>
          <span>Mark</span>
          <span>Unrealized PnL</span>
        </div>
        {positions.map((position) => {
          const instrument = position.instrument.toUpperCase();
          const instrumentMetadata = instrumentById.get(instrument);
          return (
            <div className="positions-grid" key={`${instrument}-${position.direction}`}>
              <strong>{instrument}</strong>
              <span className="tag">{position.direction.toUpperCase()}</span>
              <span>{position.size}</span>
              <strong>{formatUsd(position.entryPrice)}</strong>
              <strong>{formatUsd(position.markPrice)}</strong>
              <strong className={parseNumeric(position.unrealizedPnlUsd) >= 0 ? 'up' : 'down'}>
                {formatUsd(position.unrealizedPnlUsd)}
                {instrumentMetadata?.venue ? ` · ${instrumentMetadata.venue}` : ''}
              </strong>
            </div>
          );
        })}
        {marketData.loading && positions.length === 0 ? (
          <p className="placeholder-text">Loading positions...</p>
        ) : null}
      </div>
    );
  }

  return <p className="placeholder-text">Drop strategy notes, KPI tiles or custom signals here.</p>;
}
