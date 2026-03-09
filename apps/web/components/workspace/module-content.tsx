'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Activity, Layers3 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { OrderBookPanel } from '@/components/workspace/order-book-panel';
import { OrderEntryPanel } from '@/components/workspace/order-entry-panel';
import {
  computeTickerBaseVelocity,
  easeTickerVelocity,
  wrapTickerOffset,
} from '@/components/workspace/overview-ticker-motion';
import { PerpOrdersFillsPanel } from '@/components/workspace/perp-orders-fills-panel';
import type { WorkspaceModule } from '@/components/workspace/types';
import type { WorkspaceMarketDataState } from '@/components/workspace/use-workspace-market-data';
import { getWalletVenueLabel } from '@/lib/wallet/chains';
import { cn } from '@/lib/utils';

const DEFAULT_INSTRUMENT_ORDER = ['BTC-PERP', 'ETH-PERP', 'SOL-PERP'];
const OVERVIEW_TICKER_COPIES = [0, 1] as const;

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

function truncateAccountId(accountId: string): string {
  if (accountId.length <= 14) {
    return accountId;
  }

  return `${accountId.slice(0, 8)}...${accountId.slice(-4)}`;
}

function formatClock(timestampMs?: number): string {
  if (!timestampMs) {
    return 'Awaiting feed';
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(timestampMs);
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
  const overviewMarqueeRef = useRef<HTMLDivElement | null>(null);
  const overviewMeasureRef = useRef<HTMLDivElement | null>(null);
  const overviewTrackRef = useRef<HTMLDivElement | null>(null);
  const overviewSequenceRef = useRef<HTMLDivElement | null>(null);
  const [overviewRepeatCount, setOverviewRepeatCount] = useState(1);
  const instrumentById = new Map(
    marketData.instruments.map(
      (instrument) => [instrument.instrument.toUpperCase(), instrument] as const,
    ),
  );
  const overviewInstruments = resolveOverviewInstruments(marketData);
  const overviewCards = overviewInstruments.map((instrument) => {
    const mark = marketData.marks[instrument];
    const delta = deterministicDelta(instrument);
    const metadata = instrumentById.get(instrument);

    return {
      instrument,
      delta,
      mark,
      venue: metadata?.venue ?? 'Composite venue',
      pair:
        metadata?.baseAsset && metadata?.quoteAsset
          ? `${metadata.baseAsset}/${metadata.quoteAsset}`
          : 'PERP / USD',
    };
  });
  const repeatedOverviewCards = Array.from({ length: overviewRepeatCount }, () => overviewCards).flat();

  useEffect(() => {
    const marquee = overviewMarqueeRef.current;
    const measure = overviewMeasureRef.current;

    if (module.kind !== 'overview' || !marquee || !measure || overviewCards.length === 0) {
      return;
    }

    const updateRepeatCount = () => {
      const containerWidth = marquee.clientWidth;
      const singleSequenceWidth = measure.scrollWidth;

      if (singleSequenceWidth === 0) {
        return;
      }

      const nextRepeatCount = Math.max(
        1,
        Math.ceil(containerWidth / singleSequenceWidth),
      );

      setOverviewRepeatCount((current) => (current === nextRepeatCount ? current : nextRepeatCount));
    };

    updateRepeatCount();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      updateRepeatCount();
    });

    resizeObserver.observe(marquee);

    return () => {
      resizeObserver.disconnect();
    };
  }, [module.kind, overviewCards.length]);

  useEffect(() => {
    const marquee = overviewMarqueeRef.current;
    const track = overviewTrackRef.current;
    const sequence = overviewSequenceRef.current;

    if (module.kind !== 'overview' || !marquee || !track || !sequence) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let sequenceDistance = 0;
    let baseVelocity = 0;
    let currentVelocity = 0;
    let offset = 0;
    let isHovered = false;
    let isReducedMotion = mediaQuery.matches;
    let frameId = 0;
    let lastFrameTime = performance.now();

    const applyTransform = () => {
      if (isReducedMotion || sequenceDistance === 0) {
        track.style.transform = '';
        return;
      }

      track.style.transform = `translate3d(${offset}px, 0, 0)`;
    };

    const syncMetrics = () => {
      const trackStyles = window.getComputedStyle(track);
      const trackGap = Number.parseFloat(trackStyles.columnGap || trackStyles.gap || '0');

      sequenceDistance = sequence.scrollWidth + trackGap;
      baseVelocity = computeTickerBaseVelocity(sequenceDistance);
      currentVelocity = isHovered ? Math.min(currentVelocity, baseVelocity) : baseVelocity;
      offset = wrapTickerOffset(offset, sequenceDistance);
      applyTransform();
    };

    const stopAnimation = () => {
      if (frameId !== 0) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      }
    };

    const tick = (timestamp: number) => {
      const deltaMs = Math.min(64, timestamp - lastFrameTime);
      lastFrameTime = timestamp;

      const targetVelocity = isHovered || isReducedMotion ? 0 : baseVelocity;
      currentVelocity = easeTickerVelocity(currentVelocity, targetVelocity, deltaMs);

      if (Math.abs(currentVelocity) < 0.0001) {
        currentVelocity = targetVelocity === 0 ? 0 : targetVelocity;
      }

      if (sequenceDistance > 0 && currentVelocity > 0) {
        offset = wrapTickerOffset(offset + currentVelocity * deltaMs, sequenceDistance);
      }

      applyTransform();

      if (isReducedMotion || (targetVelocity === 0 && currentVelocity === 0)) {
        frameId = 0;
        return;
      }

      frameId = requestAnimationFrame(tick);
    };

    const startAnimation = () => {
      if (frameId !== 0 || isReducedMotion || sequenceDistance === 0) {
        return;
      }

      lastFrameTime = performance.now();
      frameId = requestAnimationFrame(tick);
    };

    const handlePointerEnter = () => {
      isHovered = true;
      startAnimation();
    };

    const handlePointerLeave = () => {
      isHovered = false;
      startAnimation();
    };

    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      isReducedMotion = event.matches;

      if (isReducedMotion) {
        currentVelocity = 0;
        offset = 0;
        stopAnimation();
        applyTransform();
        return;
      }

      syncMetrics();
      startAnimation();
    };

    syncMetrics();
    startAnimation();

    const resizeObserver = new ResizeObserver(() => {
      syncMetrics();
      startAnimation();
    });

    resizeObserver.observe(marquee);
    resizeObserver.observe(sequence);
    marquee.addEventListener('pointerenter', handlePointerEnter);
    marquee.addEventListener('pointerleave', handlePointerLeave);
    mediaQuery.addEventListener('change', handleReducedMotionChange);

    return () => {
      stopAnimation();
      resizeObserver.disconnect();
      marquee.removeEventListener('pointerenter', handlePointerEnter);
      marquee.removeEventListener('pointerleave', handlePointerLeave);
      mediaQuery.removeEventListener('change', handleReducedMotionChange);
      track.style.transform = '';
    };
  }, [module.kind, overviewRepeatCount]);

  if (module.kind === 'overview') {
    return (
      <div className="relative flex h-full flex-col gap-4">
        <ErrorBanner error={marketData.error} />
        <div className="pointer-events-none absolute h-0 overflow-hidden opacity-0" aria-hidden="true">
          <div ref={overviewMeasureRef} className="market-ticker-group">
            {overviewCards.map((card) => (
              <article
                key={`measure-${card.instrument}`}
                className="flex h-[78px] w-max min-w-[16rem] shrink-0 items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/40 px-3 py-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="whitespace-nowrap text-sm font-semibold text-foreground">
                      {card.instrument}
                    </p>
                    <DeltaBadge delta={card.delta} />
                  </div>
                  <p className="mt-0.5 whitespace-nowrap text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {card.venue}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">
                    {card.pair}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="whitespace-nowrap text-xl font-semibold tracking-tight text-foreground">
                    {card.mark ? formatUSD(card.mark.price) : '--'}
                  </p>
                  <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                    {formatClock(card.mark?.timestampMs)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div ref={overviewMarqueeRef} className="market-ticker-marquee">
          <div ref={overviewTrackRef} className="market-ticker-track">
            {OVERVIEW_TICKER_COPIES.map((copyIndex) => (
              <div
                key={copyIndex}
                ref={copyIndex === 0 ? overviewSequenceRef : undefined}
                className={cn(
                  'market-ticker-group',
                  copyIndex === 1 && 'market-ticker-group-duplicate',
                )}
                aria-hidden={copyIndex === 1}
              >
                {repeatedOverviewCards.map((card, index) => (
                  <article
                    key={`${copyIndex}-${card.instrument}-${index}`}
                    className="flex h-[78px] w-max min-w-[16rem] shrink-0 items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/40 px-3 py-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="whitespace-nowrap text-sm font-semibold text-foreground">
                          {card.instrument}
                        </p>
                        <DeltaBadge delta={card.delta} />
                      </div>
                      <p className="mt-0.5 whitespace-nowrap text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {card.venue}
                      </p>
                      <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">
                        {card.pair}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="whitespace-nowrap text-xl font-semibold tracking-tight text-foreground">
                        {card.mark ? formatUSD(card.mark.price) : '--'}
                      </p>
                      <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                        {formatClock(card.mark?.timestampMs)}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          </div>
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
        <div className="relative flex min-h-[320px] flex-1 overflow-hidden rounded-xl bg-[radial-gradient(circle_at_top_left,rgba(110,231,183,0.16),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0))]">
          <div
            className="absolute inset-0 opacity-60"
            aria-hidden="true"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px)',
              backgroundSize: 'calc(100% / 8) 100%, 100% calc(100% / 5)',
            }}
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-border/70 bg-background/70">
                {instrument}
              </Badge>
              <DeltaBadge delta={delta} />
            </div>
            <div className="flex items-center gap-2 rounded-full bg-background/65 px-3 py-1.5 backdrop-blur-sm">
              <Activity className="size-4 text-muted-foreground" />
              <div className="text-right">
                <p className="text-sm font-semibold tracking-tight text-foreground">
                  {mark ? formatUSD(mark.price) : '--'}
                </p>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Placeholder
                </p>
              </div>
            </div>
          </div>

          <div className="relative flex flex-1 items-end pt-16">
            <svg className="h-full w-full" viewBox="0 0 800 320" aria-hidden="true">
              <defs>
                <linearGradient id="chartStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(134, 239, 172, 0.7)" />
                  <stop offset="100%" stopColor="rgba(110, 231, 183, 1)" />
                </linearGradient>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(110, 231, 183, 0.28)" />
                  <stop offset="100%" stopColor="rgba(110, 231, 183, 0)" />
                </linearGradient>
              </defs>
              <path
                d="M0 268 C65 260, 120 238, 175 222 C232 205, 286 214, 345 184 C398 157, 446 109, 512 118 C585 128, 636 164, 706 136 C748 118, 774 96, 800 72"
                fill="none"
                stroke="url(#chartStroke)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M0 268 C65 260, 120 238, 175 222 C232 205, 286 214, 345 184 C398 157, 446 109, 512 118 C585 128, 636 164, 706 136 C748 118, 774 96, 800 72 L800 320 L0 320 Z"
                fill="url(#chartFill)"
              />
            </svg>
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

    return (
      <div className="flex h-full flex-col gap-4">
        <ErrorBanner error={marketData.error} />
        <OrderBookPanel instrument={instrument} midPrice={mid} />
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
        ) : positions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-background/40 px-4 py-8 text-center">
            <p className="text-sm font-medium text-foreground">No connected wallet positions</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Connect a wallet slot to load live perp positions by wallet and venue.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[360px] rounded-xl border border-border/70 bg-background/20">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Wallet</TableHead>
                  <TableHead>Venue</TableHead>
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
                  const positive = parseNumeric(position.unrealizedPnlUsd) >= 0;

                  return (
                    <TableRow key={position.positionId}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {truncateAccountId(position.accountId)}
                      </TableCell>
                      <TableCell>{getWalletVenueLabel(position.venue)}</TableCell>
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
