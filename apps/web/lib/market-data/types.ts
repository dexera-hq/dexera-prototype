export type TokenMetadata = {
  symbol: string;
  name: string;
  decimals: number;
  logoUrl?: string;
  chain: string;
  id?: string;
};

export type SpotPrice = {
  symbol: string;
  price: number;
  timestampMs: number;
};

export type Balance = {
  symbol: string;
  balance: string;
};
