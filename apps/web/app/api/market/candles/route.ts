import { NextResponse } from 'next/server';
import { getChartDataProvider } from '@/lib/chart-data/chart-data-provider';
import {
  ChartDataError,
  DEFAULT_CANDLE_LIMIT,
  MAX_CANDLE_LIMIT,
  normalizeInstrument,
  normalizeInterval,
} from '@/lib/chart-data/utils';

export const dynamic = 'force-dynamic';

function buildUrl(request: Request): URL {
  return new URL(request.url);
}

function parseRequiredString(value: string | null, fieldName: string): string {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    throw new ChartDataError(`${fieldName} is required`, 400);
  }

  return normalizedValue;
}

function parseLimit(value: string | null): number {
  if (value === null) {
    return DEFAULT_CANDLE_LIMIT;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ChartDataError('limit must be a positive integer', 400);
  }
  if (parsed > MAX_CANDLE_LIMIT) {
    throw new ChartDataError(`limit must be less than or equal to ${MAX_CANDLE_LIMIT}`, 400);
  }

  return parsed;
}

function parseEndTimeMs(value: string | null): number {
  if (value === null) {
    return Date.now();
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ChartDataError('endTimeMs must be a positive integer', 400);
  }

  return parsed;
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = buildUrl(request);
    const instrument = normalizeInstrument(
      parseRequiredString(url.searchParams.get('instrument'), 'instrument'),
    );
    const interval = normalizeInterval(
      parseRequiredString(url.searchParams.get('interval'), 'interval'),
    );
    const limit = parseLimit(url.searchParams.get('limit'));
    const endTimeMs = parseEndTimeMs(url.searchParams.get('endTimeMs'));
    const venue = url.searchParams.get('venue')?.trim().toLowerCase() || 'hyperliquid';

    if (venue !== 'hyperliquid') {
      throw new ChartDataError(`Unsupported venue "${venue}"`, 400);
    }

    const provider = getChartDataProvider();
    const candles = await provider.getCandles({
      instrument,
      interval,
      limit,
      endTimeMs,
      venue,
    });

    return NextResponse.json(candles, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof ChartDataError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Unexpected chart data provider error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
