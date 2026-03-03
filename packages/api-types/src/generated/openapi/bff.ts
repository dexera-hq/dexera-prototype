// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: contracts/openapi/bff.openapi.yaml

export type BffPublicPath = '/health' | '/api/v1/placeholder' | '/api/v1/quotes' | '/api/v1/transactions/build' | '/api/v1/positions';

export const BFF_PUBLIC_PATHS = [
  "/health",
  "/api/v1/placeholder",
  "/api/v1/quotes",
  "/api/v1/transactions/build",
  "/api/v1/positions"
] as const;

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
  amountOut: string;
  minOut: string;
  route: BffQuoteRouteHop[];
  fees: BffQuoteFees;
  requiredApprovals: BffRequiredApproval[];
  source: 'uniswap';
}

export interface BffQuoteRouteHop {
  pathIndex: number;
  hopIndex: number;
  type: string;
  address?: string;
  tokenIn?: string;
  tokenOut?: string;
}

export interface BffQuoteFeeItem {
  type?: string;
  amount?: string;
  token?: string;
  bips?: string;
  recipient?: string;
}

export interface BffQuoteFees {
  gasFee?: string;
  gasFeeQuote?: string;
  gasFeeUsd?: string;
  items: BffQuoteFeeItem[];
}

export interface BffApprovalTx {
  to: string;
  from?: string;
  data: string;
  value: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface BffRequiredApproval {
  token: string;
  spender?: string;
  requiredAmount: string;
  approvalTx: BffApprovalTx;
  cancelTx?: BffApprovalTx;
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

export const BFF_OPENAPI_INFO = {
  title: "Dexera BFF API",
  version: "0.1.0",
} as const;
