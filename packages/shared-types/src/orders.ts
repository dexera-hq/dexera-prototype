import type { Wallet } from './wallets.js';

export type OrderSide = 'buy' | 'sell';
export type OrderStatus =
  | 'pending'
  | 'open'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected';
export type PerpOrderType = 'market' | 'limit';
export type PositionDirection = 'long' | 'short';
export type UnsignedActionKind = 'perp_order_action';

export interface PerpOrderRequest extends Wallet {
  instrument: string;
  side: OrderSide;
  type: PerpOrderType;
  size: string;
  limitPrice?: string;
  leverage?: string;
  reduceOnly?: boolean;
  clientOrderId?: string;
}

export interface WalletRequestEnvelope {
  method: string;
  params?: unknown[];
}

export interface UnsignedActionPayload {
  id: string;
  accountId: string;
  venue: Wallet['venue'];
  kind: UnsignedActionKind;
  action: Record<string, unknown>;
  walletRequest: WalletRequestEnvelope;
}

export type TransactionSigningPolicy = 'client-signing-only';

export interface BuildUnsignedActionRequest {
  order: PerpOrderRequest;
}

export interface BuildUnsignedActionResponse {
  orderId: string;
  signingPolicy: TransactionSigningPolicy;
  disclaimer: string;
  unsignedActionPayload: UnsignedActionPayload;
}

export interface SubmitSignedActionRequest {
  orderId: string;
  signature: string;
  unsignedActionPayload: UnsignedActionPayload;
}

export interface SubmitSignedActionResponse extends Wallet {
  orderId: string;
  actionHash: string;
  status: string;
  venueOrderId?: string;
  source: string;
}

export interface Fill extends Wallet {
  id: string;
  orderId: string;
  instrument: string;
  side: OrderSide;
  size: string;
  price: string;
  feeAmount?: string;
  feeAsset?: string;
  filledAt: string;
}
