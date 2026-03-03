// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: contracts/openapi/bff.openapi.yaml

export type BffPublicPath = '/health' | '/api/v1/placeholder' | '/api/v1/quotes' | '/api/v1/transactions/build' | '/api/v1/positions';
export declare const BFF_PUBLIC_PATHS: readonly ["/health","/api/v1/placeholder","/api/v1/quotes","/api/v1/transactions/build","/api/v1/positions"];

export interface BffHealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

export interface BffPlaceholderResponse {
  message: string;
  source: string;
}

export interface BffQuoteRequest {
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  wallet: string;
  slippageBps?: number;
  affiliateTag?: string;
}

export interface BffQuoteResponse {
  quoteId: string;
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  estimatedOut: string;
  price: string;
  expiresAt: string;
  source: string;
}

export interface BffBuildTransactionRequest {
  quoteId: string;
  wallet: string;
  chainId: number;
}

export interface BffUnsignedTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  chainId: number;
}

export interface BffBuildTransactionResponse {
  buildId: string;
  quoteId: string;
  wallet: string;
  unsignedTx: BffUnsignedTransaction;
  warnings: string[];
  simulated: boolean;
  source: string;
}

export interface BffPosition {
  positionId: string;
  chainId: number;
  protocol: string;
  asset: string;
  balance: string;
  usdValue: string;
  unrealizedPnlUsd: string;
  lastUpdatedAt: string;
}

export interface BffPositionsResponse {
  wallet: string;
  chainId?: number;
  positions: BffPosition[];
  source: string;
}

export declare const BFF_OPENAPI_INFO: {
  readonly title: "Dexera BFF API";
  readonly version: "0.1.0";
};
