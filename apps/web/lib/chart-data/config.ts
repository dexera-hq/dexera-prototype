const DEFAULT_CHART_MARKET_DATA_SOURCE = 'mock';
const DEFAULT_HYPERLIQUID_MAINNET_API_BASE_URL = 'https://api.hyperliquid.xyz';
const DEFAULT_HYPERLIQUID_TESTNET_API_BASE_URL = 'https://api.hyperliquid-testnet.xyz';

export type ChartMarketDataSource = 'mock' | 'hyperliquid';

function normalizeSource(value: string | undefined): ChartMarketDataSource {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'hyperliquid' ? 'hyperliquid' : 'mock';
}

export function getChartMarketDataSource(): ChartMarketDataSource {
  return normalizeSource(process.env.CHART_MARKET_DATA_SOURCE ?? DEFAULT_CHART_MARKET_DATA_SOURCE);
}

export function getHyperliquidApiBaseUrl(): string {
  const explicitBaseUrl = process.env.HYPERLIQUID_API_BASE_URL?.trim();
  if (explicitBaseUrl) {
    return explicitBaseUrl.replace(/\/+$/, '');
  }

  const network = process.env.HYPERLIQUID_NETWORK?.trim().toLowerCase();
  if (network === 'testnet') {
    return DEFAULT_HYPERLIQUID_TESTNET_API_BASE_URL;
  }

  return DEFAULT_HYPERLIQUID_MAINNET_API_BASE_URL;
}
