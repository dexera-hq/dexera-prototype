'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react';

import {
  createPlaceholderOrderBook,
  evolvePlaceholderOrderBook,
  type PlaceholderOrderBookLevel,
  type PlaceholderOrderBookSnapshot,
} from '@/components/workspace/order-book-data';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type OrderBookPanelProps = {
  instrument: string;
  midPrice: number;
};

function formatPrice(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: value >= 1000 ? 2 : 3,
    maximumFractionDigits: value >= 1000 ? 2 : 3,
  });
}

function formatSize(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function formatSpread(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: value >= 1 ? 2 : 3,
    maximumFractionDigits: value >= 1 ? 2 : 3,
  });
}

function formatImbalance(value: number): string {
  const normalized = Math.abs(value * 100);
  return `${normalized.toFixed(1)}% ${value >= 0 ? 'bid' : 'ask'}`;
}

function OrderBookRow({
  level,
  spawnedOrderId,
}: {
  level: PlaceholderOrderBookLevel;
  spawnedOrderId: string;
}) {
  const isBid = level.side === 'bid';
  const isSpawned = level.spawnedSize > 0;

  return (
    <div
      className={cn(
        'group relative grid grid-cols-[1.05fr_0.8fr_0.9fr_0.5fr] items-center overflow-hidden rounded-lg px-3 py-2 text-sm backdrop-blur-sm',
        isBid ? 'bg-emerald-500/[0.045]' : 'bg-rose-500/[0.045]',
      )}
      data-spawn-id={isSpawned ? spawnedOrderId : undefined}
    >
      <div
        className={cn(
          'absolute inset-y-0 transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
          isBid ? 'left-0 bg-emerald-400/14' : 'right-0 bg-rose-400/14',
          isSpawned && isBid && 'orderbook-level-flash-buy',
          isSpawned && !isBid && 'orderbook-level-flash-sell',
        )}
        style={{ width: `${Math.max(level.depthShare * 100, 8)}%` }}
        aria-hidden="true"
      />

      {isSpawned ? (
        <div
          className={cn(
            'pointer-events-none absolute inset-y-1 flex items-center',
            isBid ? 'left-2 justify-start' : 'right-2 justify-end',
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              'orderbook-spawn-pill rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
              isBid
                ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-50'
                : 'border-rose-400/30 bg-rose-400/15 text-rose-50',
            )}
          >
            +{formatSize(level.spawnedSize)}
          </span>
        </div>
      ) : null}

      <span className={cn('relative z-10 font-semibold', isBid ? 'text-emerald-200' : 'text-rose-200')}>
        {formatPrice(level.price)}
      </span>
      <span className="relative z-10 justify-self-end text-foreground/90">{formatSize(level.size)}</span>
      <span className="relative z-10 justify-self-end text-muted-foreground">{formatSize(level.total)}</span>
      <span className="relative z-10 justify-self-end text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        {level.orderCount}
      </span>
    </div>
  );
}

export function OrderBookPanel({ instrument, midPrice }: OrderBookPanelProps) {
  const [snapshot, setSnapshot] = useState<PlaceholderOrderBookSnapshot>(() =>
    createPlaceholderOrderBook({ instrument, midPrice }),
  );
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    const nextSnapshot = createPlaceholderOrderBook({ instrument, midPrice });
    snapshotRef.current = nextSnapshot;
    setSnapshot(nextSnapshot);
  }, [instrument, midPrice]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nextSnapshot = evolvePlaceholderOrderBook(snapshotRef.current);

      snapshotRef.current = nextSnapshot;
      setSnapshot(nextSnapshot);
    }, 900);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const asks = [...snapshot.asks].reverse();
  const spawnedBuy = snapshot.spawnedOrder.aggressor === 'buy';

  return (
    <section className="flex h-full min-h-[20rem] flex-col overflow-hidden rounded-[1.35rem] border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))]">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-border/70 bg-background/60">
                {instrument}
              </Badge>
              <span className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Simulated depth
              </span>
            </div>
          </div>

          <div className="grid w-full grid-cols-3 gap-2 text-right">
            <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Spread</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{formatSpread(snapshot.spread)}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Imbalance</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{formatImbalance(snapshot.imbalance)}</p>
            </div>
            <div className="rounded-xl border border-border/60 bg-background/40 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Latest</p>
              <div className="mt-1 flex items-center justify-end gap-1.5">
                {spawnedBuy ? (
                  <ArrowUpRight className="size-3.5 text-emerald-300" />
                ) : (
                  <ArrowDownLeft className="size-3.5 text-rose-300" />
                )}
                <p className={cn('text-sm font-semibold', spawnedBuy ? 'text-emerald-200' : 'text-rose-200')}>
                  {spawnedBuy ? 'Buy sweep' : 'Sell sweep'}
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-[1.05fr_0.8fr_0.9fr_0.5fr] gap-3 px-4 pb-2 pt-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <span>Price</span>
          <span className="justify-self-end">Size</span>
          <span className="justify-self-end">Total</span>
          <span className="justify-self-end">Ord</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 pb-2">
          <div className="grid gap-1">
            {asks.map((level) => (
              <OrderBookRow
                key={level.id}
                level={level}
                spawnedOrderId={snapshot.spawnedOrder.id}
              />
            ))}
          </div>

          <div
            key={snapshot.spawnedOrder.id}
            className="orderbook-midline my-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-border/70 bg-background/55 px-4 py-3"
          >
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Best ask</p>
              <p className="mt-1 text-sm font-semibold text-rose-200">
                {formatPrice(snapshot.asks[0]?.price ?? snapshot.midPrice)}
              </p>
            </div>

            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Mid</p>
              <p className="mt-1 text-base font-semibold tracking-tight text-foreground">
                {formatPrice(snapshot.midPrice)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Best bid</p>
              <p className="mt-1 text-sm font-semibold text-emerald-200">
                {formatPrice(snapshot.bids[0]?.price ?? snapshot.midPrice)}
              </p>
            </div>
          </div>

          <div className="grid gap-1">
            {snapshot.bids.map((level) => (
              <OrderBookRow
                key={level.id}
                level={level}
                spawnedOrderId={snapshot.spawnedOrder.id}
              />
            ))}
          </div>
        </div>
    </section>
  );
}
