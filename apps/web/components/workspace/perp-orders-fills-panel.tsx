'use client';

export function PerpOrdersFillsPanel() {
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

      <div className="perp-activity-table-shell" aria-label="Perp orders and fills table placeholder">
        <div className="perp-activity-table-head">
          <span>Time</span>
          <span>Type</span>
          <span>Instrument</span>
          <span>Side</span>
          <span>Size</span>
          <span>Status</span>
          <span>Venue</span>
        </div>
        <div className="perp-activity-empty">
          <p>No recent perp orders or fills connected to this block yet.</p>
          <p>
            Next step: plug wallet-scoped order tracking first, then add fills for Hyperliquid and
            Aster.
          </p>
        </div>
      </div>
    </div>
  );
}
