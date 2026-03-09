export type PlaceholderBookSide = 'bid' | 'ask';
export type PlaceholderAggressorSide = 'buy' | 'sell';

export type PlaceholderOrderBookLevel = {
  id: string;
  side: PlaceholderBookSide;
  price: number;
  size: number;
  total: number;
  depthShare: number;
  orderCount: number;
  spawnedSize: number;
};

export type PlaceholderOrderBookEvent = {
  id: string;
  aggressor: PlaceholderAggressorSide;
  restingSide: PlaceholderBookSide;
  price: number;
  size: number;
  depthIndex: number;
  timestampMs: number;
};

export type PlaceholderOrderBookSnapshot = {
  instrument: string;
  referenceMidPrice: number;
  midPrice: number;
  spread: number;
  tickSize: number;
  step: number;
  updatedAt: number;
  imbalance: number;
  bids: PlaceholderOrderBookLevel[];
  asks: PlaceholderOrderBookLevel[];
  spawnedOrder: PlaceholderOrderBookEvent;
};

type BuildSnapshotInput = {
  depth: number;
  instrument: string;
  referenceMidPrice: number;
  step: number;
  timestampMs: number;
};

const SIZE_PRECISION = 3;

function resolveInstrumentSeed(instrument: string): number {
  return instrument
    .split('')
    .reduce((acc, char, index) => acc + char.charCodeAt(0) * (index + 17), 0);
}

function roundToTick(value: number, tickSize: number): number {
  return Math.round(value / tickSize) * tickSize;
}

function roundQuantity(value: number): number {
  return Number(value.toFixed(SIZE_PRECISION));
}

export function resolveOrderBookTickSize(midPrice: number): number {
  if (midPrice >= 50_000) {
    return 5;
  }

  if (midPrice >= 10_000) {
    return 2.5;
  }

  if (midPrice >= 1_000) {
    return 0.5;
  }

  if (midPrice >= 100) {
    return 0.05;
  }

  return 0.01;
}

function buildSnapshot({
  depth,
  instrument,
  referenceMidPrice,
  step,
  timestampMs,
}: BuildSnapshotInput): PlaceholderOrderBookSnapshot {
  const seed = resolveInstrumentSeed(instrument);
  const tickSize = resolveOrderBookTickSize(referenceMidPrice);
  const spreadTicks = 2 + ((step + seed) % 3);
  const driftWave =
    Math.sin((step + seed * 0.015) * 0.55) * tickSize * 1.5 +
    Math.cos((step + seed * 0.008) * 0.22) * tickSize * 0.9;
  const midPrice = roundToTick(referenceMidPrice + driftWave, tickSize);
  const spread = spreadTicks * tickSize;
  const bestBid = roundToTick(midPrice - spread / 2, tickSize);
  const bestAsk = roundToTick(midPrice + spread / 2, tickSize);
  const aggressor: PlaceholderAggressorSide = (step + seed) % 2 === 0 ? 'buy' : 'sell';
  const restingSide: PlaceholderBookSide = aggressor === 'buy' ? 'ask' : 'bid';
  const depthIndex = (step * 3 + seed) % Math.min(depth, 5);
  const spawnedSize = roundQuantity(
    0.42 +
      ((step + seed) % 5) * 0.21 +
      Math.abs(Math.sin((step + seed * 0.03) * 0.8)) * 1.35,
  );

  const buildSideLevels = (side: PlaceholderBookSide): PlaceholderOrderBookLevel[] => {
    let runningTotal = 0;

    return Array.from({ length: depth }, (_, index) => {
      const price =
        side === 'ask'
          ? roundToTick(bestAsk + index * tickSize, tickSize)
          : roundToTick(bestBid - index * tickSize, tickSize);
      const wave =
        Math.abs(Math.sin(step * 0.4 + index * 0.88 + seed * 0.005 + (side === 'ask' ? 0.9 : 0.2))) *
          2.2 +
        Math.abs(Math.cos(step * 0.21 + index * 0.53 + (side === 'ask' ? 0.4 : 1.1))) *
          1.4;
      const ladderBias = 0.5 + index * 0.22;
      const restingBoost =
        side === restingSide && index === depthIndex
          ? spawnedSize
          : 0;
      const size = roundQuantity(ladderBias + wave + restingBoost);

      runningTotal = roundQuantity(runningTotal + size);

      return {
        id: `${side}-${price.toFixed(8)}`,
        side,
        price,
        size,
        total: runningTotal,
        depthShare: 0,
        orderCount: 3 + ((seed + step + index * 2 + (side === 'ask' ? 1 : 0)) % 7),
        spawnedSize: restingBoost,
      };
    });
  };

  const asks = buildSideLevels('ask');
  const bids = buildSideLevels('bid');
  const maxTotal = Math.max(asks.at(-1)?.total ?? 1, bids.at(-1)?.total ?? 1);
  const normalizedAsks = asks.map((level) => ({
    ...level,
    depthShare: level.total / maxTotal,
  }));
  const normalizedBids = bids.map((level) => ({
    ...level,
    depthShare: level.total / maxTotal,
  }));
  const bestAskLevel = normalizedAsks[depthIndex] ?? normalizedAsks[0]!;
  const bestBidLevel = normalizedBids[depthIndex] ?? normalizedBids[0]!;
  const restingLevel = restingSide === 'ask' ? bestAskLevel : bestBidLevel;
  const totalBidVolume = normalizedBids.reduce((sum, level) => sum + level.size, 0);
  const totalAskVolume = normalizedAsks.reduce((sum, level) => sum + level.size, 0);
  const imbalance =
    totalBidVolume + totalAskVolume === 0
      ? 0
      : (totalBidVolume - totalAskVolume) / (totalBidVolume + totalAskVolume);

  return {
    instrument,
    referenceMidPrice,
    midPrice,
    spread,
    tickSize,
    step,
    updatedAt: timestampMs,
    imbalance,
    bids: normalizedBids,
    asks: normalizedAsks,
    spawnedOrder: {
      id: `${instrument}-${step}`,
      aggressor,
      restingSide,
      price: restingLevel.price,
      size: spawnedSize,
      depthIndex,
      timestampMs,
    },
  };
}

export function createPlaceholderOrderBook(input: {
  depth?: number;
  instrument: string;
  midPrice: number;
  timestampMs?: number;
}): PlaceholderOrderBookSnapshot {
  const depth = Math.max(6, input.depth ?? 9);
  const timestampMs = input.timestampMs ?? Date.now();
  const tickSize = resolveOrderBookTickSize(input.midPrice);
  const referenceMidPrice = roundToTick(input.midPrice, tickSize);

  return buildSnapshot({
    depth,
    instrument: input.instrument,
    referenceMidPrice,
    step: 0,
    timestampMs,
  });
}

export function evolvePlaceholderOrderBook(
  snapshot: PlaceholderOrderBookSnapshot,
  timestampMs = Date.now(),
): PlaceholderOrderBookSnapshot {
  return buildSnapshot({
    depth: Math.max(snapshot.bids.length, snapshot.asks.length, 6),
    instrument: snapshot.instrument,
    referenceMidPrice: snapshot.referenceMidPrice,
    step: snapshot.step + 1,
    timestampMs,
  });
}
