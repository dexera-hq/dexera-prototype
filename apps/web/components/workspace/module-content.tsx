'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { WorkspaceMarketDataState } from '@/components/workspace/use-workspace-market-data';
import type { WorkspaceModule } from '@/components/workspace/types';
import { buildUnsignedTransaction } from '@/lib/wallet/build-unsigned-transaction';
import { sendRuntimeSlotTransaction } from '@/lib/wallet/multi-session-runtime';
import { useWalletManager } from '@/lib/wallet/wallet-manager-context';
import { submitUnsignedTransaction } from '@/lib/wallet/sign-unsigned-transaction';
import {
  SIGNING_ONLY_DISCLAIMER_LINES,
  TransactionGuardrailError,
} from '@/lib/wallet/transaction-guardrails';

type TradeExecutionState =
  | { status: 'idle'; message: string }
  | { status: 'pending'; message: string }
  | { status: 'success'; message: string }
  | { status: 'error'; message: string };

function truncateAddress(address: string): string {
  if (address.length <= 12) {
    return address;
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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

function TradePanel({ marketData }: { marketData: WorkspaceMarketDataState }) {
  const { activeSlot } = useWalletManager();
  const ethToken = marketData.tokens.find((token) => token.symbol.toUpperCase() === 'ETH');
  const ethPrice = marketData.prices.ETH;
  const amountLabel = `${ethToken?.symbol ?? 'ETH'} · ${ethToken?.decimals ?? 18} decimals`;

  const [price, setPrice] = useState(() => (ethPrice ? ethPrice.price.toFixed(2) : '0.00'));
  const [amount, setAmount] = useState('0.10');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [executionState, setExecutionState] = useState<TradeExecutionState>({
    status: 'idle',
    message: 'Server-built unsigned transaction validation is available from the trade confirmation modal.',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showValidationToast, setShowValidationToast] = useState(false);

  const activeWalletLabel = useMemo(() => {
    if (!activeSlot) {
      return 'No wallet connected';
    }

    return `${truncateAddress(activeSlot.walletAddress)} · Chain ${activeSlot.chainId}`;
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
    if (ethPrice) {
      setPrice(ethPrice.price.toFixed(2));
    }
  }, [ethPrice]);

  const handleTradeSubmit = async () => {
    if (!activeSlot) {
      setExecutionState({
        status: 'error',
        message: 'Connect a wallet to run the unsigned-build and client-signing checks.',
      });
      return;
    }

    setIsSubmitting(true);
    setExecutionState({
      status: 'pending',
      message: 'Requesting an unsigned transaction from the server and running client-side signing checks...',
    });

    try {
      const response = await buildUnsignedTransaction({
        order: {
          walletAddress: activeSlot.walletAddress,
          chainId: activeSlot.chainId,
          symbol: 'ETH/USDT',
          side: 'buy',
          type: 'limit',
          quantity: amount.trim() || '0.10',
          limitPrice: price.trim() || (ethPrice ? ethPrice.price.toFixed(2) : '0.00'),
        },
      });

      const submission = await submitUnsignedTransaction({
        payload: response.unsignedTxPayload,
        activeWallet: activeSlot,
        submitter: {
          sendTransaction: async ({ walletAddress, payload }) =>
            sendRuntimeSlotTransaction({
              slotId: activeSlot.id,
              walletAddress,
              payload,
            }),
        },
      });

      setExecutionState({
        status: 'success',
        message: `Wallet submitted transaction ${submission.transactionHash} for ${submission.walletAddress} on chain ${submission.chainId}. Unsigned payload ${submission.unsignedTxPayloadId} passed client-side validation before submission.`,
      });
      setIsConfirmOpen(false);
      setShowValidationToast(true);
    } catch (error) {
      const message =
        error instanceof TransactionGuardrailError || error instanceof Error
          ? error.message
          : 'Trade signing demo failed unexpectedly.';

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
        Price
        <Input value={price} onChange={(event) => setPrice(event.target.value)} />
      </label>
      <label>
        Amount ({amountLabel})
        <Input value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <div className="quick-split" role="group" aria-label="Allocation presets">
        <Button type="button" variant="soft" size="sm" onClick={() => setAmount('0.25')}>
          25%
        </Button>
        <Button type="button" variant="soft" size="sm" onClick={() => setAmount('0.50')}>
          50%
        </Button>
        <Button type="button" variant="soft" size="sm" onClick={() => setAmount('0.75')}>
          75%
        </Button>
        <Button type="button" variant="soft" size="sm" onClick={() => setAmount('1.00')}>
          100%
        </Button>
      </div>
      <Button
        type="button"
        className="trade-submit"
        onClick={() => setIsConfirmOpen(true)}
        disabled={isSubmitting}
      >
        Review and Buy ETH
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
                  Confirm the unsigned transaction inputs before the wallet signs locally.
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
                <span>Wallet</span>
                <strong>{activeWalletLabel}</strong>
              </div>
              <div className="trade-summary-row">
                <span>Pair</span>
                <strong>ETH/USDT</strong>
              </div>
              <div className="trade-summary-row">
                <span>Limit price</span>
                <strong>{formatUsd(price || (ethPrice ? ethPrice.price.toFixed(2) : '0.00'))}</strong>
              </div>
              <div className="trade-summary-row">
                <span>Amount</span>
                <strong>{amount || '0.10'} {ethToken?.symbol ?? 'ETH'}</strong>
              </div>
              <div className="trade-summary-row">
                <span>Estimated notional</span>
                <strong>
                  {formatUsd(
                    String(
                      (Number(price || (ethPrice ? ethPrice.price.toFixed(2) : '0.00')) || 0) *
                        (Number(amount || '0.10') || 0),
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
                <li>Unsigned transaction data is fetched from the backend endpoint before wallet submission.</li>
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
              Wallet binding, chain match, and unsigned-payload checks all passed before wallet submission.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const DEFAULT_SYMBOL_ORDER = ['ETH', 'BTC', 'USDC', 'SOL'];

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
  pair: string,
  price: string,
  delta: string,
  positive: boolean,
) {
  return (
    <li className="ticker-pill" key={key}>
      <span>{pair}</span>
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

function resolveOverviewSymbols(marketData: WorkspaceMarketDataState): string[] {
  if (marketData.tokens.length > 0) {
    return marketData.tokens.slice(0, 4).map((token) => token.symbol.toUpperCase());
  }
  return DEFAULT_SYMBOL_ORDER;
}

function parseBalance(balance: string): number {
  const parsed = Number.parseFloat(balance);
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
  const tokenBySymbol = new Map(
    marketData.tokens.map((token) => [token.symbol.toUpperCase(), token] as const),
  );

  if (module.kind === 'overview') {
    const overviewSymbols = resolveOverviewSymbols(marketData);
    return (
      <>
        {renderMarketDataError(marketData.error)}
        <ul className="ticker-row">
          {overviewSymbols.map((symbol) => {
            const spotPrice = marketData.prices[symbol];
            const delta = deterministicDelta(symbol);
            return metricPill(
              symbol,
              `${symbol}/USD`,
              spotPrice ? formatUSD(spotPrice.price) : '--',
              delta.label,
              delta.positive,
            );
          })}
        </ul>
      </>
    );
  }

  if (module.kind === 'chart') {
    const ethPrice = marketData.prices.ETH;
    const delta = deterministicDelta('ETH');

    return (
      <>
        {renderMarketDataError(marketData.error)}
        <div className="chart-wrap">
          <div className="chart-meta">
            <p className="pair">ETH/USD</p>
            <p className="price">{ethPrice ? formatUSD(ethPrice.price) : '--'}</p>
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
    const ethPrice = marketData.prices.ETH?.price ?? 0;
    const bid = ethPrice > 0 ? ethPrice - 0.7 : 2845.1;
    const ask = ethPrice > 0 ? ethPrice + 0.7 : 2846.8;

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
    const balances = marketData.balances;
    const totalValue = balances.reduce((sum, balance) => {
      const spotPrice = marketData.prices[balance.symbol.toUpperCase()]?.price ?? 0;
      return sum + parseBalance(balance.balance) * spotPrice;
    }, 0);

    return (
      <div className="positions">
        {renderMarketDataError(marketData.error)}
        <div className="positions-pnl">
          TOTAL VALUE: <strong>{formatUSD(totalValue)}</strong>
        </div>
        <div className="positions-grid positions-head">
          <span>Asset</span>
          <span>Name</span>
          <span>Decimals</span>
          <span>Spot</span>
          <span>Balance</span>
          <span>Value</span>
        </div>
        {balances.map((balance) => {
          const symbol = balance.symbol.toUpperCase();
          const token = tokenBySymbol.get(symbol);
          const spotPrice = marketData.prices[symbol];
          const numericBalance = parseBalance(balance.balance);
          const usdValue = (spotPrice?.price ?? 0) * numericBalance;

          return (
            <div className="positions-grid" key={symbol}>
              <strong>{symbol}</strong>
              <span className="tag">{token?.name ?? 'Unknown asset'}</span>
              <span>{token?.decimals ?? '--'}</span>
              <strong>{spotPrice ? formatUSD(spotPrice.price) : '--'}</strong>
              <span>{balance.balance}</span>
              <strong className="up">{spotPrice ? formatUSD(usdValue) : '--'}</strong>
            </div>
          );
        })}
        {marketData.loading && balances.length === 0 ? (
          <p className="placeholder-text">Loading balances...</p>
        ) : null}
      </div>
    );
  }

  return <p className="placeholder-text">Drop strategy notes, KPI tiles or custom signals here.</p>;
}
