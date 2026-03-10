import type { PriceCandle } from '@/lib/market-data/types';

export type GetCandlesParams = {
  instrument: string;
  interval: string;
  limit: number;
  endTimeMs: number;
  venue: string;
};

export interface ChartDataProvider {
  getCandles(params: GetCandlesParams): Promise<PriceCandle[]>;
}
