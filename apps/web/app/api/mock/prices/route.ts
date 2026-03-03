import { NextResponse } from 'next/server';
import { getMarketDataProvider } from '@/lib/market-data/market-data-provider';
import {
  marketDataErrorResponse,
  resolveChainFromRequest,
  resolveSymbolsFromRequest,
} from '@/lib/market-data/route-helpers';

export async function GET(request: Request): Promise<Response> {
  try {
    const symbols = resolveSymbolsFromRequest(request);
    const chain = resolveChainFromRequest(request);
    const provider = getMarketDataProvider();
    // Unknown symbols are intentionally omitted from the response map.
    const prices = await provider.getSpotPrices(symbols, chain);
    return NextResponse.json(prices);
  } catch (error) {
    return marketDataErrorResponse(error);
  }
}
