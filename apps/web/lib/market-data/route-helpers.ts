import { NextResponse } from 'next/server';
import { getDefaultChain } from '@/lib/market-data/config';

function buildUrl(request: Request): URL {
  return new URL(request.url);
}

export function resolveChainFromRequest(request: Request): string {
  const chainParam = buildUrl(request).searchParams.get('chain')?.trim();
  if (chainParam && chainParam.length > 0) {
    return chainParam;
  }

  return getDefaultChain();
}

export function resolveSymbolsFromRequest(request: Request): string[] {
  const symbolsParam = buildUrl(request).searchParams.get('symbols');
  if (!symbolsParam) {
    return [];
  }

  const normalized = symbolsParam
    .split(',')
    .map((symbol) => symbol.trim().toUpperCase())
    .filter((symbol) => symbol.length > 0);

  return [...new Set(normalized)];
}

export function resolveAccountFromRequest(request: Request): string | undefined {
  const account = buildUrl(request).searchParams.get('account')?.trim();
  return account && account.length > 0 ? account : undefined;
}

export function marketDataErrorResponse(error: unknown): Response {
  const message =
    error instanceof Error && error.message.trim().length > 0
      ? error.message
      : 'Unexpected market data provider error';
  const normalizedMessage = message.toLowerCase();
  const status = normalizedMessage.includes('not implemented') ? 501 : 500;

  return NextResponse.json({ error: message }, { status });
}
