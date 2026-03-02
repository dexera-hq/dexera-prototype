// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: contracts/openapi/bff.openapi.yaml

export type BffPublicPath = '/health' | '/api/v1/placeholder';

export const BFF_PUBLIC_PATHS = [
  "/health",
  "/api/v1/placeholder"
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

export const BFF_OPENAPI_INFO = {
  title: "Dexera BFF API",
  version: "0.1.0",
} as const;
