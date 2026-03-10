'use client';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  buildExposureDashboardViewModel,
  type ExposureInstrumentSummary,
  type ExposureVenueSummary,
} from '@/components/workspace/exposure-dashboard-logic';
import type { PerpPosition } from '@/lib/market-data/types';
import { getWalletVenueLabel } from '@/lib/wallet/chains';
import { cn } from '@/lib/utils';

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatUsd(value: number): string {
  return USD_FORMATTER.format(value);
}

function formatSignedUsd(value: number): string {
  const formatted = USD_FORMATTER.format(Math.abs(value));
  if (Object.is(value, 0) || value === 0) {
    return formatted;
  }

  return value > 0 ? `+${formatted}` : `-${formatted}`;
}

function formatShare(value: number, total: number): string {
  if (total <= 0) {
    return '0.0%';
  }

  return `${((value / total) * 100).toFixed(1)}%`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function ExposureMetric({
  label,
  value,
  detail,
  valueClassName,
}: {
  label: string;
  value: string;
  detail: string;
  valueClassName?: string;
}) {
  return (
    <article className="rounded-xl border border-border/70 bg-background/35 px-3 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p
        className={cn('mt-2 text-lg font-semibold tracking-tight text-foreground', valueClassName)}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

function ExposureInstrumentRow({
  summary,
  totalNotionalValue,
}: {
  summary: ExposureInstrumentSummary;
  totalNotionalValue: number;
}) {
  const share =
    totalNotionalValue > 0 ? (summary.totalNotionalValue / totalNotionalValue) * 100 : 0;
  const shareWidth = share <= 0 ? '0%' : `${Math.max(8, Math.min(100, share))}%`;

  return (
    <article className="rounded-xl border border-border/70 bg-background/35 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{summary.instrument}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pluralize(summary.walletCount, 'wallet')} ·{' '}
            {pluralize(summary.openPositionCount, 'position')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">
            {formatUsd(summary.totalNotionalValue)}
          </p>
          <p
            className={cn(
              'mt-1 text-xs',
              summary.totalUnrealizedPnlUsd >= 0 ? 'text-emerald-200' : 'text-rose-200',
            )}
          >
            {formatSignedUsd(summary.totalUnrealizedPnlUsd)}
          </p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/80">
        <div className="h-full rounded-full bg-cyan-300/75" style={{ width: shareWidth }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>{formatShare(summary.totalNotionalValue, totalNotionalValue)} of gross</span>
        <span>
          L {formatUsd(summary.totalLongNotionalValue)} / S{' '}
          {formatUsd(summary.totalShortNotionalValue)}
        </span>
      </div>
    </article>
  );
}

function ExposureVenueRow({
  summary,
  totalNotionalValue,
}: {
  summary: ExposureVenueSummary;
  totalNotionalValue: number;
}) {
  const share =
    totalNotionalValue > 0 ? (summary.totalNotionalValue / totalNotionalValue) * 100 : 0;
  const shareWidth = share <= 0 ? '0%' : `${Math.max(8, Math.min(100, share))}%`;

  return (
    <article className="rounded-xl border border-border/70 bg-background/35 px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {getWalletVenueLabel(summary.venue)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pluralize(summary.walletCount, 'wallet')} ·{' '}
            {pluralize(summary.openPositionCount, 'position')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-foreground">
            {formatUsd(summary.totalNotionalValue)}
          </p>
          <p
            className={cn(
              'mt-1 text-xs',
              summary.totalUnrealizedPnlUsd >= 0 ? 'text-emerald-200' : 'text-rose-200',
            )}
          >
            {formatSignedUsd(summary.totalUnrealizedPnlUsd)}
          </p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/80">
        <div className="h-full rounded-full bg-amber-300/80" style={{ width: shareWidth }} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <span>{formatShare(summary.totalNotionalValue, totalNotionalValue)} of gross</span>
        <span>
          L {formatUsd(summary.totalLongNotionalValue)} / S{' '}
          {formatUsd(summary.totalShortNotionalValue)}
        </span>
      </div>
    </article>
  );
}

export function ExposureDashboardPanel({
  positions,
  connectedWalletCount,
  loading,
}: {
  positions: readonly PerpPosition[];
  connectedWalletCount: number;
  loading: boolean;
}) {
  const viewModel = buildExposureDashboardViewModel(positions, connectedWalletCount);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="rounded-xl border border-border/70 bg-background/40 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Consolidated exposure</p>
            <p className="text-sm text-muted-foreground">
              Hyperliquid and Aster perp positions rolled up across connected wallets
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{pluralize(viewModel.connectedWalletCount, 'wallet')}</Badge>
            <Badge variant="outline" className="border-border/70 bg-background/70">
              {pluralize(viewModel.openPositionCount, 'open position')}
            </Badge>
          </div>
        </div>
      </div>

      {loading && viewModel.openPositionCount === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Loading consolidated exposure...
        </div>
      ) : viewModel.openPositionCount === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">No aggregated perp exposure</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect Hyperliquid or Aster wallet slots and open perp positions to populate this
            block.
          </p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1 pr-1">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <ExposureMetric
                label="Gross Exposure"
                value={formatUsd(viewModel.totalNotionalValue)}
                detail={`${pluralize(viewModel.activeWalletCount, 'wallet')} with live perp exposure`}
              />
              <ExposureMetric
                label="Unrealized PnL"
                value={formatSignedUsd(viewModel.totalUnrealizedPnlUsd)}
                detail={`${pluralize(viewModel.openPositionCount, 'position')} across connected venues`}
                valueClassName={
                  viewModel.totalUnrealizedPnlUsd >= 0 ? 'text-emerald-200' : 'text-rose-200'
                }
              />
              <ExposureMetric
                label="Long Exposure"
                value={formatUsd(viewModel.totalLongNotionalValue)}
                detail={`${formatShare(viewModel.totalLongNotionalValue, viewModel.totalNotionalValue)} of gross`}
              />
              <ExposureMetric
                label="Short Exposure"
                value={formatUsd(viewModel.totalShortNotionalValue)}
                detail={`${formatShare(
                  viewModel.totalShortNotionalValue,
                  viewModel.totalNotionalValue,
                )} of gross`}
              />
            </div>

            <section className="rounded-xl border border-border/70 bg-background/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Top instruments</p>
                  <p className="text-xs text-muted-foreground">
                    Ranked by gross perp notional across connected wallets
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {viewModel.topInstruments.map((summary) => (
                  <ExposureInstrumentRow
                    key={summary.instrument}
                    summary={summary}
                    totalNotionalValue={viewModel.totalNotionalValue}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-border/70 bg-background/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Venue split</p>
                  <p className="text-xs text-muted-foreground">
                    Exposure concentration across supported perp venues
                  </p>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {viewModel.topVenues.map((summary) => (
                  <ExposureVenueRow
                    key={summary.venue}
                    summary={summary}
                    totalNotionalValue={viewModel.totalNotionalValue}
                  />
                ))}
              </div>
            </section>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
