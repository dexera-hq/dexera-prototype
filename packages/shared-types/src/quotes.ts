export interface NormalizedQuoteRouteHop {
  pathIndex: number;
  hopIndex: number;
  type: string;
  address?: string;
  tokenIn?: string;
  tokenOut?: string;
}

export interface NormalizedQuoteFeeItem {
  type?: string;
  amount?: string;
  token?: string;
  bips?: string;
  recipient?: string;
}

export interface NormalizedQuoteFees {
  gasFee?: string;
  gasFeeQuote?: string;
  gasFeeUsd?: string;
  items: NormalizedQuoteFeeItem[];
}

export interface ApprovalTx {
  to: string;
  from?: string;
  data: string;
  value: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface RequiredApproval {
  token: string;
  spender?: string;
  requiredAmount: string;
  approvalTx: ApprovalTx;
  cancelTx?: ApprovalTx;
}

export interface UnsignedTransaction {
  to: string;
  data: string;
  value: string;
  gasLimit: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  chainId: number;
}

export interface QuoteSafety {
  minOut: string;
  deadline: string;
}

export interface NormalizedQuote {
  quoteId: string;
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  amountOut: string;
  minOut: string;
  safety: QuoteSafety;
  unsignedTx: UnsignedTransaction;
  route: NormalizedQuoteRouteHop[];
  fees: NormalizedQuoteFees;
  requiredApprovals: RequiredApproval[];
  source: 'uniswap';
}
