'use client';

import { getWalletVenueLabel } from '@/lib/wallet/chains';
import {
  formatTrackedPerpActionStatusLabel,
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

export function PerpOrdersFillsPanel() {
  const { activeSlot } = useWalletManager();
  const { actions } = useSubmittedPerpActionsTracker();

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

      <div className="perp-activity-scope">
        <span>Hyperliquid / Aster</span>
        <span>Perp only</span>
        <span>No generic EVM tx table</span>
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
        </div>

        {actions.length > 0 ? (
          <div className="perp-activity-table-body">
            {actions.map((action) => (
              <div className="perp-activity-table-row" key={action.id}>
                <span>{formatTimestamp(action.updatedAt)}</span>
                <span>Order</span>
                <span>{action.instrument}</span>
                <span>{action.side.toUpperCase()}</span>
                <span>{action.size}</span>
                <span>
                  <span className={`perp-activity-status status-${action.status}`}>
                    {formatTrackedPerpActionStatusLabel(action.status)}
                  </span>
                </span>
                <span>{getWalletVenueLabel(action.venue)}</span>
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
            <p>Fills will be added in the next step.</p>
          </div>
        )}
      </div>
    </div>
  );
}
