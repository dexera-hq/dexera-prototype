import type { ChainId } from './index.js';
import type { Wallet } from './wallets.js';

export type OrderSide = 'buy' | 'sell';
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

interface BaseOrderRequest extends Wallet {
  symbol: string;
  side: OrderSide;
  quantity: string;
  clientOrderId?: string;
}

export interface MarketOrderRequest extends BaseOrderRequest {
  type: 'market';
  limitPrice?: never;
}

export interface LimitOrderRequest extends BaseOrderRequest {
  type: 'limit';
  limitPrice: string;
}

export type OrderRequest = MarketOrderRequest | LimitOrderRequest;
export type OrderRequestType = OrderRequest['type'];

interface BaseOrder extends Wallet {
  id: string;
  symbol: string;
  side: OrderSide;
  quantity: string;
  status: OrderStatus;
  filledQuantity: string;
  averageFillPrice?: string;
  createdAt: string;
  updatedAt: string;
  quoteId?: string;
  unsignedTxPayloadId?: string;
}

export interface MarketOrder extends BaseOrder {
  type: 'market';
  limitPrice?: never;
}

export interface LimitOrder extends BaseOrder {
  type: 'limit';
  limitPrice: string;
}

export type Order = MarketOrder | LimitOrder;
export type OrderType = Order['type'];

export interface Quote extends Wallet {
  id: string;
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
  chainId: ChainId;
  kind: TxPayloadKind;
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
}

export interface Fill extends Wallet {
  id: string;
  orderId: string;
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
