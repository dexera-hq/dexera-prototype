import { NextResponse } from 'next/server';
import { getMarketDataProvider } from '@/lib/market-data/market-data-provider';
import { marketDataErrorResponse, resolveChainFromRequest } from '@/lib/market-data/route-helpers';

export async function GET(request: Request): Promise<Response> {
  try {
    const chain = resolveChainFromRequest(request);
    const provider = getMarketDataProvider();
    const tokens = await provider.getTokens(chain);
    return NextResponse.json(tokens);
  } catch (error) {
    return marketDataErrorResponse(error);
  }
}
