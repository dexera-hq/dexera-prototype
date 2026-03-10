import type { PriceCandle } from '@/lib/market-data/types';
import type { ChartDataProvider, GetCandlesParams } from './provider';
import { generateMockPriceCandles } from './mock-chart-data';

export class MockChartDataProvider implements ChartDataProvider {
  async getCandles(params: GetCandlesParams): Promise<PriceCandle[]> {
    return generateMockPriceCandles(params);
  }
}
