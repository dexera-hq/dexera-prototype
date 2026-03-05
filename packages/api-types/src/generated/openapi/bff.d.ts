// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: contracts/openapi/bff.openapi.yaml

export type BffPublicPath =
  | '/health'
  | '/api/v1/placeholder'
  | '/api/v1/wallet/challenge'
  | '/api/v1/wallet/verify'
  | '/api/v1/perp/orders/preview'
  | '/api/v1/perp/actions/unsigned'
  | '/api/v1/perp/actions/submit'
  | '/api/v1/perp/positions';
export declare const BFF_PUBLIC_PATHS: readonly [
  '/health',
  '/api/v1/placeholder',
  '/api/v1/wallet/challenge',
  '/api/v1/wallet/verify',
  '/api/v1/perp/orders/preview',
  '/api/v1/perp/actions/unsigned',
  '/api/v1/perp/actions/submit',
  '/api/v1/perp/positions',
];

export type BffVenueId = 'hyperliquid' | 'aster';
export type BffPerpOrderSide = 'buy' | 'sell';
export type BffPerpOrderType = 'market' | 'limit';
export type BffPerpPositionDirection = 'long' | 'short';
export type BffPerpPositionStatus = 'open' | 'closed' | 'liquidated';

export interface BffHealthResponse {
  status: 'ok';
  service: string;
  timestamp: string;
}

export interface BffPlaceholderResponse {
  message: string;
  source: string;
}

export interface BffWalletChallengeRequest {
  address: string;
}

export interface BffWalletChallengeResponse {
  challengeId: string;
  message: string;
  issuedAt: string;
  expiresAt: string;
}

export interface BffWalletVerifyRequest {
  address: string;
  challengeId: string;
  signature: string;
  venue: BffVenueId;
}

export interface BffWalletVerifyResponse {
  ownershipVerified: boolean;
  venue: BffVenueId;
  eligible: boolean;
  reason: string;
  checkedAt: string;
  source: string;
}

export interface BffPerpOrderRequest {
  accountId: string;
  venue: BffVenueId;
  instrument: string;
  side: BffPerpOrderSide;
  type: BffPerpOrderType;
  size: string;
  limitPrice?: string;
  leverage?: string;
  reduceOnly?: boolean;
  clientOrderId?: string;
}

export interface BffBuildUnsignedActionRequest {
  order: BffPerpOrderRequest;
}

export interface BffPerpOrderPreviewResponse {
  previewId: string;
  accountId: string;
  venue: BffVenueId;
  instrument: string;
  side: BffPerpOrderSide;
  type: BffPerpOrderType;
  size: string;
  limitPrice?: string;
  markPrice?: string;
  estimatedNotional: string;
  estimatedFee: string;
  expiresAt: string;
  source: string;
}

export interface BffUnsignedActionPayload {
  id: string;
  accountId: string;
  venue: BffVenueId;
  kind: 'perp_order_action';
  action: Record<string, unknown>;
  walletRequest: BffWalletRequestEnvelope;
}

export interface BffWalletRequestEnvelope {
  method: string;
  params?: unknown[];
}

export interface BffBuildUnsignedActionResponse {
  orderId: string;
  signingPolicy: 'client-signing-only';
  disclaimer: string;
  unsignedActionPayload: BffUnsignedActionPayload;
}

export interface BffSubmitSignedActionRequest {
  orderId: string;
  signature: string;
  unsignedActionPayload: BffUnsignedActionPayload;
}

export interface BffSubmitSignedActionResponse {
  orderId: string;
  actionHash: string;
  venue: BffVenueId;
  status: string;
  venueOrderId?: string;
  source: string;
}

export interface BffPerpPosition {
  positionId: string;
  accountId: string;
  venue: BffVenueId;
  instrument: string;
  direction: BffPerpPositionDirection;
  status: BffPerpPositionStatus;
  size: string;
  entryPrice: string;
  markPrice: string;
  notionalValue: string;
  leverage?: string;
  unrealizedPnlUsd: string;
  lastUpdatedAt: string;
}

export interface BffPerpPositionsResponse {
  accountId: string;
  venue: BffVenueId;
  positions: BffPerpPosition[];
  source: string;
}

export declare const BFF_OPENAPI_INFO: {
  readonly title: 'Dexera BFF API';
  readonly version: '0.2.0';
};
