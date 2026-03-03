'use client';

import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const MOCK_SIGNING_DISCLAIMER =
  'Workspace demo uses mocked unsigned transaction building for now, but the signature request is sent to the connected wallet.';

function createMockUnsignedTransactionFetch(
  walletAddress: string,
  chainId: number,
): typeof fetch {
  return async (_input, init) => {
    const requestText = typeof init?.body === 'string' ? init.body : '{}';
    let parsedRequest: {
      order?: {
        quantity?: string;
        limitPrice?: string;
      };
    } = {};

    try {
      parsedRequest = JSON.parse(requestText) as typeof parsedRequest;
    } catch {
      parsedRequest = {};
    }

    const quantity = parsedRequest.order?.quantity?.trim() || '0.10';
    const limitPrice = parsedRequest.order?.limitPrice?.trim() || '2845.32';
    const mockBody = {
      orderId: 'ord_mock_trade_panel',
      signingPolicy: 'client-signing-only',
      disclaimer: MOCK_SIGNING_DISCLAIMER,
      unsignedTxPayload: {
        id: 'utxp_mock_trade_panel',
        walletAddress,
        chainId,
        kind: 'evm_transaction',
        to: '0x1111111111111111111111111111111111111111',
        data: `0xdeadbeef${quantity.replace('.', '')}${limitPrice.replace('.', '')}`,
        value: '0',
        gasLimit: '210000',
        maxFeePerGas: '25000000000',
        maxPriorityFeePerGas: '1500000000',
      },
    };

    return {
      ok: true,
      status: 200,
      json: async () => mockBody,
    } as Response;
  };
}

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

function TradePanel() {
  const { activeSlot } = useWalletManager();
  const [price, setPrice] = useState('2845.32');
  const [amount, setAmount] = useState('0.10');
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [executionState, setExecutionState] = useState<TradeExecutionState>({
    status: 'idle',
    message: 'Signing preview is available from the trade confirmation modal.',
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
      message: 'Building mocked unsigned transaction and running client-side signing checks...',
    });

    try {
      const response = await buildUnsignedTransaction(
        {
          order: {
            walletAddress: activeSlot.walletAddress,
            chainId: activeSlot.chainId,
            symbol: 'ETH/USDT',
            side: 'buy',
            type: 'limit',
            quantity: amount.trim() || '0.10',
            limitPrice: price.trim() || '2845.32',
          },
        },
        {
          fetchImpl: createMockUnsignedTransactionFetch(activeSlot.walletAddress, activeSlot.chainId),
        },
      );

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
        Amount (ETH)
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
                <strong>{formatUsd(price || '2845.32')}</strong>
              </div>
              <div className="trade-summary-row">
                <span>Amount</span>
                <strong>{amount || '0.10'} ETH</strong>
              </div>
              <div className="trade-summary-row">
                <span>Estimated notional</span>
                <strong>{formatUsd(String((Number(price || '2845.32') || 0) * (Number(amount || '0.10') || 0)))}</strong>
              </div>
            </div>

            <div className="trade-modal-guardrails">
            <p className="trade-modal-section-title">Signing guardrails</p>
              <ul className="trade-disclaimer-list">
                {SIGNING_ONLY_DISCLAIMER_LINES.map((line) => (
                  <li key={line}>{line}</li>
                ))}
                <li>{MOCK_SIGNING_DISCLAIMER}</li>
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

function metricPill(pair: string, price: string, delta: string, positive: boolean) {
  return (
    <li className="ticker-pill">
      <span>{pair}</span>
      <strong>{price}</strong>
      <em className={positive ? 'up' : 'down'}>{delta}</em>
    </li>
  );
}

export function ModuleContent({ module }: { module: WorkspaceModule }) {
  if (module.kind === 'overview') {
    return (
      <ul className="ticker-row">
        {metricPill('ETH/USDT', '$2,845.32', '+3.24%', true)}
        {metricPill('BTC/USDT', '$68,432.10', '+1.85%', true)}
        {metricPill('SOL/USDT', '$142.67', '-2.14%', false)}
        {metricPill('AVAX/USDT', '$38.92', '+5.67%', true)}
      </ul>
    );
  }

  if (module.kind === 'chart') {
    return (
      <div className="chart-wrap">
        <div className="chart-meta">
          <p className="pair">ETH/USDT</p>
          <p className="price">$2,845.32</p>
          <p className="delta up">+3.24% (+$89.21)</p>
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
    );
  }

  if (module.kind === 'trade') {
    return <TradePanel />;
  }

  if (module.kind === 'orderbook') {
    return (
      <div className="orderbook">
        <div className="orderbook-row sell">
          <span>2,847.50</span>
          <span>2.458</span>
          <span>6,997.02</span>
        </div>
        <div className="orderbook-row sell">
          <span>2,846.80</span>
          <span>1.192</span>
          <span>3,392.58</span>
        </div>
        <p className="spread">Spread: 0.40 (0.014%)</p>
        <div className="orderbook-row buy">
          <span>2,845.10</span>
          <span>1.567</span>
          <span>4,460.11</span>
        </div>
        <div className="orderbook-row buy">
          <span>2,844.70</span>
          <span>2.204</span>
          <span>6,269.32</span>
        </div>
      </div>
    );
  }

  if (module.kind === 'positions') {
    return (
      <div className="positions">
        <div className="positions-pnl">
          TOTAL PNL: <strong>+$1,079.78 (+3.21%)</strong>
        </div>
        <div className="positions-grid positions-head">
          <span>Pair</span>
          <span>Type</span>
          <span>Entry</span>
          <span>Current</span>
          <span>Amount</span>
          <span>PNL</span>
        </div>
        <div className="positions-grid">
          <strong>ETH/USDT</strong>
          <span className="tag">Long</span>
          <span>$2,720.50</span>
          <strong>$2,845.32</strong>
          <span>1.5 ETH</span>
          <strong className="up">+187.23</strong>
        </div>
      </div>
    );
  }

  return <p className="placeholder-text">Drop strategy notes, KPI tiles or custom signals here.</p>;
}
