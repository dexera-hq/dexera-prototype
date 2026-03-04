export type InstrumentMetadata = {
  instrument: string;
  name: string;
  venue: string;
  baseAsset?: string;
  quoteAsset?: string;
};

export type MarkPrice = {
  instrument: string;
  price: number;
  timestampMs: number;
};

export type PerpPosition = {
  instrument: string;
  direction: 'long' | 'short';
  size: string;
  entryPrice: string;
  markPrice: string;
  unrealizedPnlUsd: string;
  notionalValue: string;
  leverage?: string;
  status: 'open' | 'closed' | 'liquidated';
};
