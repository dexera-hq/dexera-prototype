import type { PriceCandle } from '@/lib/market-data/types';

export const ONE_MINUTE_MS = 60_000;
export const DEFAULT_CANDLE_LIMIT = 240;
export const MAX_CANDLE_LIMIT = 500;

export class ChartDataError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'ChartDataError';
    this.status = status;
  }
}

export function normalizeInstrument(instrument: string): string {
  return instrument.trim().toUpperCase();
}

export function normalizeInterval(interval: string): string {
  return interval.trim().toLowerCase();
}

export function getIntervalMs(interval: string): number {
  if (normalizeInterval(interval) === '1m') {
    return ONE_MINUTE_MS;
  }

  throw new ChartDataError(`Unsupported interval "${interval}"`, 400);
}

export function getCoinFromInstrument(instrument: string): string {
  const normalized = normalizeInstrument(instrument);
  if (!normalized.endsWith('-PERP')) {
    throw new ChartDataError(`Unsupported instrument "${instrument}"`, 400);
  }

  const coin = normalized.slice(0, -'-PERP'.length);
  if (coin.length === 0) {
    throw new ChartDataError(`Unsupported instrument "${instrument}"`, 400);
  }

  return coin;
}

export function sortCandles(candles: PriceCandle[]): PriceCandle[] {
  return [...candles].sort((left, right) => left.openTimeMs - right.openTimeMs);
}

export function mergePriceCandles(
  currentCandles: PriceCandle[],
  nextCandles: PriceCandle[],
  maxCandles: number,
): PriceCandle[] {
  const mergedByTime = new Map<number, PriceCandle>();

  for (const candle of currentCandles) {
    mergedByTime.set(candle.openTimeMs, candle);
  }

  for (const candle of nextCandles) {
    mergedByTime.set(candle.openTimeMs, candle);
  }

  const merged = [...mergedByTime.values()].sort(
    (left, right) => left.openTimeMs - right.openTimeMs,
  );
  return merged.slice(Math.max(0, merged.length - maxCandles));
}

export function createCandleRange(
  limit: number,
  endTimeMs: number,
  interval: string,
): {
  alignedEndTimeMs: number;
  startTimeMs: number;
} {
  const intervalMs = getIntervalMs(interval);
  const alignedEndTimeMs = Math.max(endTimeMs, 0);
  const latestOpenTimeMs = Math.floor(alignedEndTimeMs / intervalMs) * intervalMs;
  const startTimeMs = latestOpenTimeMs - (limit - 1) * intervalMs;

  return {
    alignedEndTimeMs,
    startTimeMs,
  };
}
