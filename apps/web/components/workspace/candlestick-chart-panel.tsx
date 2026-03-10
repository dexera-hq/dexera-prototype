'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity } from 'lucide-react';
import type {
  CandlestickData,
  IChartApi,
  ISeriesApi,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';
import { Badge } from '@/components/ui/badge';
import { DEFAULT_CANDLE_LIMIT, mergePriceCandles } from '@/lib/chart-data/utils';
import type { PriceCandle } from '@/lib/market-data/types';

const CHART_INSTRUMENT = 'BTC-PERP';
const CHART_INTERVAL = '1m';
const CHART_VENUE = 'hyperliquid';
const POLL_INTERVAL_MS = 5_000;
const POLL_LIMIT = 2;

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function toChartData(candle: PriceCandle): CandlestickData<Time> {
  return {
    time: Math.floor(candle.openTimeMs / 1000) as UTCTimestamp,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  };
}

function formatUsd(value?: number): string {
  return typeof value === 'number' ? USD_FORMATTER.format(value) : '--';
}

function formatTimestamp(timestampMs?: number): string {
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unable to load chart candles';
}

async function decodeCandles(response: Response): Promise<PriceCandle[]> {
  if (response.ok) {
    return (await response.json()) as PriceCandle[];
  }

  let message = `Chart request failed (${response.status})`;
  try {
    const payload = (await response.json()) as { error?: string };
    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      message = payload.error;
    }
  } catch {
    // Ignore malformed error payloads and keep the default message.
  }

  throw new Error(message);
}

function buildCandlesUrl(limit: number): string {
  const params = new URLSearchParams({
    instrument: CHART_INSTRUMENT,
    interval: CHART_INTERVAL,
    limit: String(limit),
    venue: CHART_VENUE,
  });

  return `/api/market/candles?${params.toString()}`;
}

export function CandlestickChartPanel() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null);
  const candlesRef = useRef<PriceCandle[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCandle, setLastCandle] = useState<PriceCandle | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let disposed = false;

    const loadCandles = async (limit: number, replaceSeries: boolean) => {
      abortControllerRef.current?.abort();

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch(buildCandlesUrl(limit), {
          signal: abortController.signal,
          cache: 'no-store',
        });
        const nextCandles = await decodeCandles(response);

        if (abortController.signal.aborted) {
          return false;
        }

        const series = seriesRef.current;
        const chart = chartRef.current;
        if (!series || !chart || nextCandles.length === 0) {
          throw new Error('Chart returned no candle data');
        }

        if (replaceSeries) {
          candlesRef.current = nextCandles.slice(-DEFAULT_CANDLE_LIMIT);
          series.setData(candlesRef.current.map(toChartData));
          chart.timeScale().fitContent();
        } else {
          candlesRef.current = mergePriceCandles(
            candlesRef.current,
            nextCandles,
            DEFAULT_CANDLE_LIMIT,
          );
          for (const candle of nextCandles) {
            series.update(toChartData(candle));
          }
        }

        const latestCandle = candlesRef.current[candlesRef.current.length - 1] ?? null;
        setLastCandle(latestCandle);
        setIsLoading(false);
        setError(null);
        return true;
      } catch (nextError) {
        if (abortController.signal.aborted) {
          return false;
        }

        setError(getErrorMessage(nextError));
        setIsLoading(false);
        return false;
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    };

    async function setupChart(): Promise<void> {
      try {
        const { CandlestickSeries, ColorType, createChart } = await import('lightweight-charts');
        if (disposed || !containerRef.current) {
          return;
        }

        const chart = createChart(containerRef.current, {
          width: Math.max(containerRef.current.clientWidth, 280),
          height: Math.max(containerRef.current.clientHeight, 320),
          autoSize: false,
          layout: {
            background: {
              type: ColorType.Solid,
              color: 'transparent',
            },
            textColor: 'rgba(226, 232, 240, 0.76)',
            fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          },
          grid: {
            vertLines: {
              color: 'rgba(148, 163, 184, 0.12)',
            },
            horzLines: {
              color: 'rgba(148, 163, 184, 0.12)',
            },
          },
          rightPriceScale: {
            borderVisible: false,
          },
          timeScale: {
            borderVisible: false,
            timeVisible: true,
            secondsVisible: false,
          },
          crosshair: {
            vertLine: {
              color: 'rgba(148, 163, 184, 0.22)',
            },
            horzLine: {
              color: 'rgba(148, 163, 184, 0.22)',
            },
          },
        });

        const series = chart.addSeries(CandlestickSeries, {
          upColor: 'rgba(110, 231, 183, 0.95)',
          downColor: 'rgba(251, 113, 133, 0.95)',
          wickUpColor: 'rgba(110, 231, 183, 0.95)',
          wickDownColor: 'rgba(251, 113, 133, 0.95)',
          borderVisible: false,
          priceLineVisible: true,
          lastValueVisible: true,
        });

        series.priceScale().applyOptions({
          borderVisible: false,
          scaleMargins: {
            top: 0.14,
            bottom: 0.08,
          },
        });

        chartRef.current = chart;
        seriesRef.current = series;

        const resizeChart = () => {
          const element = containerRef.current;
          const currentChart = chartRef.current;
          if (!element || !currentChart) {
            return;
          }

          currentChart.applyOptions({
            width: Math.max(element.clientWidth, 280),
            height: Math.max(element.clientHeight, 320),
          });
        };

        resizeObserverRef.current = new ResizeObserver(() => {
          resizeChart();
        });
        resizeObserverRef.current.observe(containerRef.current);
        resizeChart();

        const initialLoadSucceeded = await loadCandles(DEFAULT_CANDLE_LIMIT, true);
        if (!initialLoadSucceeded || disposed) {
          return;
        }

        pollTimerRef.current = window.setInterval(() => {
          void loadCandles(POLL_LIMIT, false);
        }, POLL_INTERVAL_MS);
      } catch (setupError) {
        if (disposed) {
          return;
        }

        setIsLoading(false);
        setError(getErrorMessage(setupError));
      }
    }

    void setupChart();

    return () => {
      disposed = true;
      abortControllerRef.current?.abort();

      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }

      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
      seriesRef.current = null;
      candlesRef.current = [];
    };
  }, []);

  return (
    <section
      data-testid="candlestick-chart"
      className="flex h-full min-h-[320px] flex-col overflow-hidden rounded-[1.35rem] border border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(110,231,183,0.18),transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.018))]"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-border/70 bg-background/60">
              {CHART_INSTRUMENT}
            </Badge>
            <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {CHART_INTERVAL} candles
            </span>
          </div>
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Hyperliquid feed
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/55 px-3 py-1.5 backdrop-blur-sm">
          <Activity className="size-4 text-muted-foreground" />
          <div className="text-right">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              {formatUsd(lastCandle?.close)}
            </p>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              {formatTimestamp(lastCandle?.closeTimeMs)}
            </p>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-[320px] flex-1">
        <div ref={containerRef} className="h-full w-full" />

        {isLoading ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/18 backdrop-blur-[1px]">
            <div className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Loading candles
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="pointer-events-none absolute inset-x-4 top-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
            {error}
          </div>
        ) : null}
      </div>
    </section>
  );
}
