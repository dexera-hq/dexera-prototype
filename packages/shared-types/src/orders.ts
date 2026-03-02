export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus =
  | 'pending'
  | 'open'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected';
export type QuoteStatus = 'fresh' | 'stale' | 'expired';
export type TxPayloadKind = 'evm_transaction';
export type FillLiquidity = 'maker' | 'taker';

export interface OrderRequest {
  walletAddress: string;
  chainId: number;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  limitPrice?: string;
  clientOrderId?: string;
}

export interface Order {
  id: string;
  walletAddress: string;
  chainId: number;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  limitPrice?: string;
  status: OrderStatus;
  filledQuantity: string;
  averageFillPrice?: string;
  createdAt: string;
  updatedAt: string;
  quoteId?: string;
  unsignedTxPayloadId?: string;
}

export interface Quote {
  id: string;
  walletAddress: string;
  chainId: number;
  symbol: string;
  side: OrderSide;
  quantity: string;
  price: string;
  estimatedTotal: string;
  slippageBps: number;
  expiresAt: string;
  status: QuoteStatus;
  createdAt: string;
}

export interface UnsignedTxPayload {
  id: string;
  chainId: number;
  kind: TxPayloadKind;
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
}

export interface Fill {
  id: string;
  orderId: string;
  walletAddress: string;
  chainId: number;
  symbol: string;
  side: OrderSide;
  quantity: string;
  price: string;
  feeAmount?: string;
  feeAsset?: string;
  liquidity?: FillLiquidity;
  txHash?: string;
  filledAt: string;
}
