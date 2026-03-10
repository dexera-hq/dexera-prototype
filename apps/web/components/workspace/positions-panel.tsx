'use client';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  buildOpenPositionsViewModel,
  type PositionDisplayRow,
} from '@/components/workspace/positions-panel-logic';
import type { PerpPosition } from '@/lib/market-data/types';
import { getWalletVenueLabel } from '@/lib/wallet/chains';
import { cn } from '@/lib/utils';

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function parseNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function truncateAccountId(accountId: string): string {
  if (accountId.length <= 14) {
    return accountId;
  }

  return `${accountId.slice(0, 8)}...${accountId.slice(-4)}`;
}

function formatUsd(value: string): string {
  return USD_FORMATTER.format(parseNumber(value));
}

function formatSignedUsd(value: string | number): string {
  const numericValue = typeof value === 'number' ? value : parseNumber(value);
  const formatted = USD_FORMATTER.format(Math.abs(numericValue));
  if (Object.is(numericValue, 0) || numericValue === 0) {
    return formatted;
  }

  return numericValue > 0 ? `+${formatted}` : `-${formatted}`;
}

function PositionMetric({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground sm:hidden">
        {label}
      </p>
      <p className={cn('text-sm text-foreground sm:text-right', valueClassName)}>{value}</p>
    </div>
  );
}

function PositionRow({ position }: { position: PositionDisplayRow }) {
  const positivePnl = parseNumber(position.unrealizedPnlUsd) >= 0;

  return (
    <article className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)] sm:items-center">
      <div className="flex items-start justify-between gap-3 sm:block">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {position.instrument.toUpperCase()}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              variant={position.direction === 'long' ? 'success' : 'destructive'}
              className="uppercase"
            >
              {position.direction}
            </Badge>
          </div>
        </div>
        <p
          className={cn(
            'text-right text-sm font-medium sm:hidden',
            positivePnl ? 'text-emerald-200' : 'text-rose-200',
          )}
        >
          {formatSignedUsd(position.unrealizedPnlUsd)}
        </p>
      </div>

      <PositionMetric label="Size" value={position.size} />
      <PositionMetric label="Entry" value={formatUsd(position.entryPrice)} />
      <PositionMetric label="Current" value={formatUsd(position.currentPrice)} />
      <PositionMetric
        label="UPnL"
        value={formatSignedUsd(position.unrealizedPnlUsd)}
        valueClassName={cn(
          'hidden sm:block sm:font-medium',
          positivePnl ? 'sm:text-emerald-200' : 'sm:text-rose-200',
        )}
      />
    </article>
  );
}

export function PositionsPanel({
  positions,
  loading,
}: {
  positions: readonly PerpPosition[];
  loading: boolean;
}) {
  const viewModel = buildOpenPositionsViewModel(positions);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/40 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-foreground">Open positions</p>
          <p className="text-sm text-muted-foreground">
            Per-wallet perp exposure grouped by connected venue
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{viewModel.openPositionCount} open</Badge>
          <Badge variant="outline" className="border-border/70 bg-background/70">
            Exposure {USD_FORMATTER.format(viewModel.totalNotionalValue)}
          </Badge>
          <Badge
            variant={viewModel.totalUnrealizedPnlUsd >= 0 ? 'success' : 'destructive'}
            className="font-medium"
          >
            UPnL {formatSignedUsd(viewModel.totalUnrealizedPnlUsd)}
          </Badge>
        </div>
      </div>

      {loading && viewModel.openPositionCount === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Loading positions...
        </div>
      ) : viewModel.openPositionCount === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-8 text-center">
          <p className="text-sm font-medium text-foreground">No open positions</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect a wallet slot and open a perp position to populate this block.
          </p>
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1 rounded-xl border border-border/70 bg-background/20">
          <div className="space-y-4 p-3">
            {viewModel.groups.map((group) => (
              <section
                key={group.key}
                className="overflow-hidden rounded-xl border border-border/70 bg-background/55"
              >
                <div className="flex flex-col gap-3 border-b border-border/70 bg-background/80 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm text-foreground">
                          {truncateAccountId(group.accountId)}
                        </p>
                        <Badge variant="outline" className="border-border/70 bg-background/70">
                          {getWalletVenueLabel(group.venue)}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        {group.openPositionCount} open position
                        {group.openPositionCount === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          Exposure
                        </p>
                        <p className="font-medium text-foreground">
                          {USD_FORMATTER.format(group.totalNotionalValue)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                          UPnL
                        </p>
                        <p
                          className={cn(
                            'font-medium',
                            group.totalUnrealizedPnlUsd >= 0 ? 'text-emerald-200' : 'text-rose-200',
                          )}
                        >
                          {formatSignedUsd(group.totalUnrealizedPnlUsd)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="hidden grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1fr)] gap-3 border-b border-border/50 px-4 py-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground sm:grid">
                  <span>Position</span>
                  <span className="text-right">Size</span>
                  <span className="text-right">Entry</span>
                  <span className="text-right">Current</span>
                  <span className="text-right">UPnL</span>
                </div>

                <div className="divide-y divide-border/60">
                  {group.positions.map((position) => (
                    <PositionRow key={position.positionId} position={position} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
