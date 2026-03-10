import type { PriceCandle } from '@/lib/market-data/types';
import { ChartDataError, createCandleRange, getIntervalMs, normalizeInstrument } from './utils';

const BASE_PRICE_BY_INSTRUMENT: Readonly<Record<string, number>> = {
  'BTC-PERP': 68450.25,
  'ETH-PERP': 3200.15,
  'SOL-PERP': 145.4,
};

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

function randomFromSeed(seed: string): number {
  return fnv1a32(seed) / 0xffffffff;
}

function roundTo(value: number, fractionDigits: number): number {
  return Number(value.toFixed(fractionDigits));
}

function getBasePrice(instrument: string): number {
  const normalizedInstrument = normalizeInstrument(instrument);
  const basePrice = BASE_PRICE_BY_INSTRUMENT[normalizedInstrument];

  if (basePrice === undefined) {
    throw new ChartDataError(`Unsupported instrument "${instrument}"`, 400);
  }

  return basePrice;
}

export type GenerateMockCandlesParams = {
  instrument: string;
  interval: string;
  limit: number;
  endTimeMs: number;
  nowMs?: number;
};

export function generateMockPriceCandles({
  instrument,
  interval,
  limit,
  endTimeMs,
  nowMs = Date.now(),
}: GenerateMockCandlesParams): PriceCandle[] {
  const normalizedInstrument = normalizeInstrument(instrument);
  const basePrice = getBasePrice(normalizedInstrument);
  const intervalMs = getIntervalMs(interval);
  const { startTimeMs } = createCandleRange(limit, endTimeMs, interval);
  const latestLiveOpenTimeMs = Math.floor(nowMs / intervalMs) * intervalMs;
  const candles: PriceCandle[] = [];

  let previousClose = basePrice;
  for (let index = 0; index < limit; index += 1) {
    const openTimeMs = startTimeMs + index * intervalMs;
    const closeTimeMs = openTimeMs + intervalMs;
    const bodySeed = `${normalizedInstrument}:${openTimeMs}:body`;
    const wickSeed = `${normalizedInstrument}:${openTimeMs}:wick`;
    const volumeSeed = `${normalizedInstrument}:${openTimeMs}:volume`;
    const bodyDrift = (randomFromSeed(bodySeed) - 0.5) * basePrice * 0.0042;
    const wickRange = basePrice * (0.001 + randomFromSeed(wickSeed) * 0.0025);
    const targetClose = Math.max(previousClose + bodyDrift, basePrice * 0.15);
    const isLiveCandle = openTimeMs === latestLiveOpenTimeMs && nowMs < closeTimeMs;

    let close = targetClose;
    let high = Math.max(previousClose, close) + wickRange;
    let low = Math.min(previousClose, close) - wickRange * 0.92;
    let volume = 12 + randomFromSeed(volumeSeed) * 36;

    if (isLiveCandle) {
      const progress = Math.min(1, Math.max(0, (nowMs - openTimeMs) / intervalMs));
      const liveMicroDrift =
        Math.sin((nowMs - openTimeMs) / 11_000) * basePrice * 0.00045 +
        (randomFromSeed(`${normalizedInstrument}:${Math.floor(nowMs / 5_000)}:live`) - 0.5) *
          basePrice *
          0.00022;

      close = Math.max(previousClose + bodyDrift * progress + liveMicroDrift, basePrice * 0.15);
      high = Math.max(previousClose, close) + wickRange * (0.3 + progress * 0.7);
      low = Math.min(previousClose, close) - wickRange * (0.22 + progress * 0.58);
      volume *= 0.4 + progress * 0.9;
    }

    const candle: PriceCandle = {
      instrument: normalizedInstrument,
      interval,
      openTimeMs,
      closeTimeMs,
      open: roundTo(previousClose, 2),
      high: roundTo(Math.max(high, previousClose, close), 2),
      low: roundTo(Math.min(low, previousClose, close), 2),
      close: roundTo(close, 2),
      volume: roundTo(volume, 4),
    };

    candles.push(candle);
    previousClose = candle.close;
  }

  return candles;
}
