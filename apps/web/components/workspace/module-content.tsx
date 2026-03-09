'use client';

import { ArrowDownRight, ArrowUpRight, Activity, Layers3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderEntryPanel } from '@/components/workspace/order-entry-panel';
import { PerpOrdersFillsPanel } from '@/components/workspace/perp-orders-fills-panel';
import type { WorkspaceModule } from '@/components/workspace/types';
import type { WorkspaceMarketDataState } from '@/components/workspace/use-workspace-market-data';
import { cn } from '@/lib/utils';

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

function ErrorBanner({ error }: { error: string | null }) {
  if (!error) {
    return null;
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
      {error}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: { label: string; positive: boolean } }) {
  return (
    <Badge variant={delta.positive ? 'success' : 'destructive'} className="gap-1">
      {delta.positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {delta.label}
    </Badge>
  );
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
      <div className="flex h-full flex-col gap-4">
        <ErrorBanner error={marketData.error} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {overviewInstruments.map((instrument) => {
            const mark = marketData.marks[instrument];
            const delta = deterministicDelta(instrument);

            return (
              <Card key={instrument} className="border-border/70 bg-background/40 shadow-none">
                <CardContent className="flex h-full flex-col justify-between gap-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{instrument}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        Market summary
                      </p>
                    </div>
                    <DeltaBadge delta={delta} />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold tracking-tight text-foreground">
                      {mark ? formatUSD(mark.price) : '--'}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">Venue reference price</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  if (module.kind === 'chart') {
    const instrument = resolveTradeInstrument(marketData);
    const mark = marketData.marks[instrument];
    const delta = deterministicDelta(instrument);

    return (
      <div className="flex h-full flex-col gap-4">
        <ErrorBanner error={marketData.error} />
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-xl border border-border/70 bg-background/40 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-border/70 bg-background/60">
                Primary instrument
              </Badge>
              <DeltaBadge delta={delta} />
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">
              {mark ? formatUSD(mark.price) : '--'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{instrument}</p>
            <p className="mt-6 text-sm leading-6 text-muted-foreground">
              Lightweight prototype visualization for the selected venue mark. Replace with the
              production charting surface when data density increases.
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-background/40 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Intraday trend</p>
                <p className="text-sm text-muted-foreground">
                  Illustrative curve based on current mark
                </p>
              </div>
              <Activity className="size-4 text-muted-foreground" />
            </div>
            <div className="rounded-xl border border-border/70 bg-card/70 p-2">
              <svg className="h-[240px] w-full" viewBox="0 0 800 280" aria-hidden="true">
                <defs>
                  <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(110, 231, 183, 0.35)" />
                    <stop offset="100%" stopColor="rgba(110, 231, 183, 0)" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 250 C80 225, 130 210, 190 205 C260 200, 315 215, 370 190 C430 160, 500 120, 570 125 C640 130, 700 150, 800 70"
                  fill="none"
                  stroke="rgb(110 231 183)"
                  strokeWidth="3"
                />
                <path
                  d="M0 250 C80 225, 130 210, 190 205 C260 200, 315 215, 370 190 C430 160, 500 120, 570 125 C640 130, 700 150, 800 70 L800 280 L0 280 Z"
                  fill="url(#chartFill)"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (module.kind === 'trade') {
    return (
      <div className="flex h-full flex-col gap-4">
        <ErrorBanner error={marketData.error} />
        <OrderEntryPanel marketData={marketData} />
      </div>
    );
  }

  if (module.kind === 'orders') {
    return (
      <div className="flex h-full flex-col gap-4">
        <ErrorBanner error={marketData.error} />
        <PerpOrdersFillsPanel />
      </div>
    );
  }

  if (module.kind === 'orderbook') {
    const instrument = resolveTradeInstrument(marketData);
    const mid = marketData.marks[instrument]?.price ?? 3200;
    const bid = mid - 0.7;
    const ask = mid + 0.7;
    const rows = [
      { side: 'Ask', price: ask.toFixed(2), size: '2.458', total: (ask * 2.458).toFixed(2) },
      {
        side: 'Ask',
        price: (ask + 0.4).toFixed(2),
        size: '1.192',
        total: ((ask + 0.4) * 1.192).toFixed(2),
      },
      { side: 'Bid', price: bid.toFixed(2), size: '1.567', total: (bid * 1.567).toFixed(2) },
      {
        side: 'Bid',
        price: (bid - 0.4).toFixed(2),
        size: '2.204',
        total: ((bid - 0.4) * 2.204).toFixed(2),
      },
    ];

    return (
      <div className="flex h-full flex-col gap-4">
        <ErrorBanner error={marketData.error} />
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/40 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">{instrument}</p>
            <p className="text-sm text-muted-foreground">
              Spread {formatUSD(ask - bid)} around current midpoint
            </p>
          </div>
          <Badge variant="outline">Order book</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Side</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.side}-${row.price}`}>
                <TableCell>
                  <Badge variant={row.side === 'Bid' ? 'success' : 'destructive'}>{row.side}</Badge>
                </TableCell>
                <TableCell className="font-medium text-foreground">{row.price}</TableCell>
                <TableCell>{row.size}</TableCell>
                <TableCell>{row.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (module.kind === 'positions') {
    const positions = marketData.positions;
    const totalValue = positions.reduce(
      (sum, position) => sum + parseNumeric(position.notionalValue),
      0,
    );

    return (
      <div className="flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/40 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Open positions</p>
            <p className="text-sm text-muted-foreground">Cross-venue perp exposure summary</p>
          </div>
          <Badge variant="secondary">Total {formatUSD(totalValue)}</Badge>
        </div>

        <ErrorBanner error={marketData.error} />

        {marketData.loading && positions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
            Loading positions...
          </div>
        ) : (
          <ScrollArea className="max-h-[360px] rounded-xl border border-border/70 bg-background/20">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Instrument</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Entry</TableHead>
                  <TableHead>Mark</TableHead>
                  <TableHead>Unrealized PnL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((position) => {
                  const instrument = position.instrument.toUpperCase();
                  const instrumentMetadata = instrumentById.get(instrument);
                  const positive = parseNumeric(position.unrealizedPnlUsd) >= 0;

                  return (
                    <TableRow key={`${instrument}-${position.direction}`}>
                      <TableCell className="font-medium text-foreground">{instrument}</TableCell>
                      <TableCell>
                        <Badge
                          variant={position.direction === 'long' ? 'success' : 'destructive'}
                          className="uppercase"
                        >
                          {position.direction.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>{position.size}</TableCell>
                      <TableCell>{formatUsd(position.entryPrice)}</TableCell>
                      <TableCell>{formatUsd(position.markPrice)}</TableCell>
                      <TableCell
                        className={cn(
                          'font-medium',
                          positive ? 'text-emerald-200' : 'text-rose-200',
                        )}
                      >
                        {formatUsd(position.unrealizedPnlUsd)}
                        {instrumentMetadata?.venue ? ` · ${instrumentMetadata.venue}` : ''}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-background/40 p-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border border-border/70 bg-card/70">
        <Layers3 className="size-5 text-muted-foreground" />
      </div>
      <p className="mt-4 text-base font-medium text-foreground">Custom widget placeholder</p>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
        Drop strategy notes, KPI tiles, or custom signals here when bespoke workspace blocks are
        ready.
      </p>
    </div>
  );
}
