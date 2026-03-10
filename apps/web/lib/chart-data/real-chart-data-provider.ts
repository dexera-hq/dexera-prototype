import type { PriceCandle } from '@/lib/market-data/types';
import { getHyperliquidApiBaseUrl } from './config';
import type { ChartDataProvider, GetCandlesParams } from './provider';
import {
  ChartDataError,
  createCandleRange,
  getCoinFromInstrument,
  normalizeInstrument,
} from './utils';

type HyperliquidCandlePayload = {
  T: number;
  c: string;
  h: string;
  i: string;
  l: string;
  n: number;
  o: string;
  s: string;
  t: number;
  v: string;
};

function parseNumericField(value: string, fieldName: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new ChartDataError(`Hyperliquid returned an invalid ${fieldName}`, 502);
  }

  return parsed;
}

export class RealChartDataProvider implements ChartDataProvider {
  async getCandles({
    instrument,
    interval,
    limit,
    endTimeMs,
    venue,
  }: GetCandlesParams): Promise<PriceCandle[]> {
    if (venue !== 'hyperliquid') {
      throw new ChartDataError(`Unsupported venue "${venue}"`, 400);
    }

    const normalizedInstrument = normalizeInstrument(instrument);
    const coin = getCoinFromInstrument(normalizedInstrument);
    const { alignedEndTimeMs, startTimeMs } = createCandleRange(limit, endTimeMs, interval);
    const response = await fetch(`${getHyperliquidApiBaseUrl()}/info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        type: 'candleSnapshot',
        req: {
          coin,
          interval,
          startTime: startTimeMs,
          endTime: alignedEndTimeMs,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ChartDataError(
        body.trim().length > 0
          ? `Hyperliquid candle request failed (${response.status}): ${body}`
          : `Hyperliquid candle request failed (${response.status})`,
        502,
      );
    }

    const payload = (await response.json()) as HyperliquidCandlePayload[];
    return payload
      .map((candle) => ({
        instrument: normalizedInstrument,
        interval,
        openTimeMs: candle.t,
        closeTimeMs: candle.T,
        open: parseNumericField(candle.o, 'open'),
        high: parseNumericField(candle.h, 'high'),
        low: parseNumericField(candle.l, 'low'),
        close: parseNumericField(candle.c, 'close'),
        volume: parseNumericField(candle.v, 'volume'),
      }))
      .sort((left, right) => left.openTimeMs - right.openTimeMs);
  }
}
