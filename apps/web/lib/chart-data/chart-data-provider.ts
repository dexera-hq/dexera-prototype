import { getChartMarketDataSource } from './config';
import { MockChartDataProvider } from './mock-chart-data-provider';
import type { ChartDataProvider } from './provider';
import { RealChartDataProvider } from './real-chart-data-provider';

export function getChartDataProvider(): ChartDataProvider {
  if (getChartMarketDataSource() === 'hyperliquid') {
    return new RealChartDataProvider();
  }

  return new MockChartDataProvider();
}
