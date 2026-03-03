const DEFAULT_CHAIN_FALLBACK = 'hyperliquid';

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (typeof value !== 'string') {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }

  return defaultValue;
}

export function getDefaultChain(): string {
  const chain = process.env.DEFAULT_CHAIN?.trim();
  return chain && chain.length > 0 ? chain : DEFAULT_CHAIN_FALLBACK;
}

export function isMockMarketDataEnabled(): boolean {
  return parseBooleanEnv(process.env.MOCK_MARKET_DATA, true);
}

export function isMockMarketDataJitterEnabled(): boolean {
  return parseBooleanEnv(process.env.MOCK_MARKET_DATA_JITTER, false);
}
