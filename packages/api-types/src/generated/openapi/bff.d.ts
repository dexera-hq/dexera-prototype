// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: contracts/openapi/bff.openapi.yaml

export type BffPublicPath = '/health' | '/api/v1/placeholder' | '/api/v1/quotes' | '/api/v1/transactions/build' | '/api/v1/transactions/unsigned' | '/api/v1/positions';
export declare const BFF_PUBLIC_PATHS: readonly ["/health","/api/v1/placeholder","/api/v1/quotes","/api/v1/transactions/build","/api/v1/transactions/unsigned","/api/v1/positions"];

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
  safety: BffQuoteSafety;
  unsignedTx: BffUnsignedTransaction;
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

export interface BffQuoteSafety {
  minOut: string;
  deadline: string;
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

export interface BffOrderRequest {
  walletAddress: string;
  chainId: number;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: string;
  clientOrderId?: string;
  limitPrice?: string;
}

export interface BffBuildUnsignedTransactionRequest {
  order: BffOrderRequest;
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

export interface BffUnsignedTxPayload {
  id: string;
  walletAddress: string;
  chainId: number;
  kind: 'evm_transaction';
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
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

export interface BffBuildUnsignedTransactionResponse {
  orderId: string;
  signingPolicy: 'client-signing-only';
  disclaimer: string;
  unsignedTxPayload: BffUnsignedTxPayload;
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
