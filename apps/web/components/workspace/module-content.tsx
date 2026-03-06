'use client';

import { OrderEntryPanel } from '@/components/workspace/order-entry-panel';
import { PerpOrdersFillsTable } from '@/components/workspace/perp-orders-fills-table';
import type { WorkspaceModule } from '@/components/workspace/types';
import type { WorkspaceMarketDataState } from '@/components/workspace/use-workspace-market-data';
import { usePerpActivity } from '@/components/workspace/perp-activity-context';

const DEFAULT_INSTRUMENT_ORDER = ['BTC-PERP', 'ETH-PERP', 'SOL-PERP'];

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

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

function resolveTradeInstrument(marketData: WorkspaceMarketDataState): string {
  const preferred = marketData.instruments.find(
    (instrument) => instrument.instrument === 'ETH-PERP',
  );
  if (preferred) {
    return preferred.instrument;
  }

  return marketData.instruments[0]?.instrument ?? 'ETH-PERP';
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
  const { recordSubmittedAction } = usePerpActivity();
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
        <OrderEntryPanel
          marketData={marketData}
          onActionSubmitted={(receipt) => {
            recordSubmittedAction({
              orderId: receipt.orderId,
              actionHash: receipt.actionHash,
              unsignedActionPayloadId: receipt.unsignedActionPayloadId,
              accountId: receipt.accountId,
              venue: receipt.venue,
              venueOrderId: receipt.venueOrderId,
              instrument: receipt.instrument,
              side: receipt.side,
              type: receipt.type,
              size: receipt.size,
              limitPrice: receipt.limitPrice,
              markPrice: receipt.markPrice,
              reduceOnly: receipt.reduceOnly,
              submittedAt: receipt.submittedAt,
            });
          }}
        />
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

  if (module.kind === 'activity') {
    return <PerpOrdersFillsTable />;
  }

  return <p className="placeholder-text">Drop strategy notes, KPI tiles or custom signals here.</p>;
}
