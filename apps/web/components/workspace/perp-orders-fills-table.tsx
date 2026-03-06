'use client';

import { useState } from 'react';
import { usePerpActivity } from '@/components/workspace/perp-activity-context';
import { getWalletVenueLabel } from '@/lib/wallet/chains';
import { getWalletPerpActivity } from '@/lib/wallet/perp-activity';
import { useWalletManager } from '@/lib/wallet/wallet-manager-context';

type ActivityTab = 'actions' | 'fills';

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function truncateValue(value: string, prefix = 10, suffix = 6): string {
  if (value.length <= prefix + suffix + 3) {
    return value;
  }

  return `${value.slice(0, prefix)}...${value.slice(-suffix)}`;
}

function formatTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }

  return TIMESTAMP_FORMATTER.format(parsed);
}

function formatUsdNumber(value: string): string {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return `$${parsed.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

function truncateAccountId(accountId: string): string {
  if (accountId.length <= 14) {
    return accountId;
  }

  return `${accountId.slice(0, 8)}...${accountId.slice(-4)}`;
}

export function PerpOrdersFillsTable() {
  const { activeSlot } = useWalletManager();
  const { ledger } = usePerpActivity();
  const [activeTab, setActiveTab] = useState<ActivityTab>('actions');

  if (!activeSlot) {
    return (
      <p className="placeholder-text">
        Connect and verify a Hyperliquid or Aster wallet to view recent perp orders/actions and
        fills.
      </p>
    );
  }

  const walletActivity = getWalletPerpActivity(ledger, activeSlot.accountId, activeSlot.venue);
  const actionCount = walletActivity.actions.length;
  const fillCount = walletActivity.fills.length;
  const walletLabel = `${truncateAccountId(activeSlot.accountId)} · ${getWalletVenueLabel(
    activeSlot.venue,
  )}`;

  return (
    <div className="perp-activity">
      <div className="perp-activity-header">
        <p className="perp-activity-title">Wallet Activity</p>
        <p className="perp-activity-wallet" title={activeSlot.accountId}>
          {walletLabel}
        </p>
      </div>

      <div className="perp-activity-tabbar" role="tablist" aria-label="Perp activity tables">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'actions'}
          className={activeTab === 'actions' ? 'perp-activity-tab is-active' : 'perp-activity-tab'}
          onClick={() => setActiveTab('actions')}
        >
          Orders / Actions ({actionCount})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'fills'}
          className={activeTab === 'fills' ? 'perp-activity-tab is-active' : 'perp-activity-tab'}
          onClick={() => setActiveTab('fills')}
        >
          Fills ({fillCount})
        </button>
      </div>

      {activeTab === 'actions' ? (
        actionCount === 0 ? (
          <p className="placeholder-text">
            No submitted perp actions for this wallet yet. Submit an order from Order Entry to
            populate this table.
          </p>
        ) : (
          <div className="perp-activity-table-wrap">
            <table className="perp-activity-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Instrument</th>
                  <th>Side</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Limit / Mark</th>
                  <th>Order ID</th>
                  <th>Action Hash</th>
                </tr>
              </thead>
              <tbody>
                {walletActivity.actions.map((action) => (
                  <tr key={action.id}>
                    <td>{formatTimestamp(action.submittedAt)}</td>
                    <td>{action.instrument}</td>
                    <td className={action.side === 'buy' ? 'up' : 'down'}>{action.side}</td>
                    <td>{action.type}</td>
                    <td>{action.size}</td>
                    <td>{formatUsdNumber(action.limitPrice ?? action.markPrice ?? '--')}</td>
                    <td title={action.orderId}>{truncateValue(action.orderId)}</td>
                    <td title={action.actionHash}>{truncateValue(action.actionHash)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : fillCount === 0 ? (
        <p className="placeholder-text">
          No fill rows yet for this wallet. Fills appear after successful perp submissions.
        </p>
      ) : (
        <div className="perp-activity-table-wrap">
          <table className="perp-activity-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Instrument</th>
                <th>Side</th>
                <th>Fill Size</th>
                <th>Fill Price</th>
                <th>Fee</th>
                <th>Order ID</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {walletActivity.fills.map((fill) => (
                <tr key={fill.id}>
                  <td>{formatTimestamp(fill.filledAt)}</td>
                  <td>{fill.instrument}</td>
                  <td className={fill.side === 'buy' ? 'up' : 'down'}>{fill.side}</td>
                  <td>{fill.size}</td>
                  <td>{formatUsdNumber(fill.price)}</td>
                  <td>
                    {formatUsdNumber(fill.feeAmount)} {fill.feeAsset}
                  </td>
                  <td title={fill.orderId}>{truncateValue(fill.orderId)}</td>
                  <td>{fill.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
