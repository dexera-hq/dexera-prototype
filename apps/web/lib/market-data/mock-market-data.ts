import type { Balance, SpotPrice, TokenMetadata } from '@/lib/market-data/types';

const MOCK_TOKENS: readonly TokenMetadata[] = [
  {
    symbol: 'ETH',
    name: 'Ether',
    decimals: 18,
    chain: 'hyperliquid',
    id: 'eth',
    logoUrl: 'https://assets.coingecko.com/coins/images/279/small/ethereum.png',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    decimals: 8,
    chain: 'hyperliquid',
    id: 'btc',
    logoUrl: 'https://assets.coingecko.com/coins/images/1/small/bitcoin.png',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    chain: 'hyperliquid',
    id: 'usdc',
    logoUrl: 'https://assets.coingecko.com/coins/images/6319/small/usdc.png',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    chain: 'hyperliquid',
    id: 'sol',
    logoUrl: 'https://assets.coingecko.com/coins/images/4128/small/solana.png',
  },
];

const BASE_PRICE_BY_SYMBOL: Readonly<Record<string, number>> = {
  ETH: 3200.15,
  BTC: 68450.25,
  USDC: 1,
  SOL: 145.4,
};

const BASE_BALANCES: ReadonlyArray<{ symbol: string; balance: number }> = [
  { symbol: 'ETH', balance: 1.5321 },
  { symbol: 'BTC', balance: 0.084225 },
  { symbol: 'USDC', balance: 12450.55 },
  { symbol: 'SOL', balance: 312.48 },
];

const BALANCE_DIGITS_BY_SYMBOL: Readonly<Record<string, number>> = {
  ETH: 4,
  BTC: 6,
  USDC: 2,
  SOL: 3,
};

const JITTER_WINDOW_MS = 30_000;

function normalizeChain(chain: string | undefined): string | undefined {
  if (typeof chain !== 'string') {
    return undefined;
  }

  const normalized = chain.trim().toLowerCase();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function roundTo(value: number, fractionDigits: number): number {
  return Number(value.toFixed(fractionDigits));
}

function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function resolveSymbols(symbols: string[]): string[] {
  const requested = symbols.map(normalizeSymbol).filter((symbol) => symbol.length > 0);
  if (requested.length === 0) {
    return Object.keys(BASE_PRICE_BY_SYMBOL);
  }

  return [...new Set(requested)];
}

function applyJitter(basePrice: number, symbol: string, timestampMs: number): number {
  const jitterBucket = Math.floor(timestampMs / JITTER_WINDOW_MS);
  const seed = fnv1a32(`${symbol}:${jitterBucket}`);
  const offset = ((seed % 101) - 50) / 10_000;
  return roundTo(basePrice * (1 + offset), 2);
}

function formatBalance(symbol: string, balance: number): string {
  const digits = BALANCE_DIGITS_BY_SYMBOL[symbol] ?? 4;
  return balance.toFixed(digits);
}

function getAccountScaleFactor(account: string): number {
  const hash = fnv1a32(account.trim().toLowerCase());
  return 0.85 + (hash % 31) / 100;
}

function getSymbolScaleFactor(account: string, symbol: string): number {
  const hash = fnv1a32(`${account}:${symbol}`);
  return 0.92 + (hash % 17) / 100;
}

export function getMockTokens(chain?: string): TokenMetadata[] {
  const normalizedChain = normalizeChain(chain);
  const tokens =
    normalizedChain === undefined
      ? MOCK_TOKENS
      : MOCK_TOKENS.filter((token) => token.chain.toLowerCase() === normalizedChain);

  return tokens.map((token) => ({ ...token }));
}

export function getMockSpotPrices(
  symbols: string[],
  opts?: { jitter?: boolean },
): Record<string, SpotPrice> {
  const timestampMs = Date.now();
  const resolvedSymbols = resolveSymbols(symbols);
  const prices: Record<string, SpotPrice> = {};

  for (const symbol of resolvedSymbols) {
    const basePrice = BASE_PRICE_BY_SYMBOL[symbol];
    if (basePrice === undefined) {
      continue;
    }

    const price = opts?.jitter ? applyJitter(basePrice, symbol, timestampMs) : basePrice;
    prices[symbol] = {
      symbol,
      price,
      timestampMs,
    };
  }

  return prices;
}

export function getMockBalances(account?: string): Balance[] {
  const normalizedAccount = account?.trim().toLowerCase();
  if (!normalizedAccount) {
    return BASE_BALANCES.map((entry) => ({
      symbol: entry.symbol,
      balance: formatBalance(entry.symbol, entry.balance),
    }));
  }

  const accountScaleFactor = getAccountScaleFactor(normalizedAccount);
  return BASE_BALANCES.map((entry) => {
    const symbolScaleFactor = getSymbolScaleFactor(normalizedAccount, entry.symbol);
    const adjustedBalance = entry.balance * accountScaleFactor * symbolScaleFactor;
    return {
      symbol: entry.symbol,
      balance: formatBalance(entry.symbol, adjustedBalance),
    };
  });
}
