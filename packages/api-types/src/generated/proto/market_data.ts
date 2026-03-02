// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: contracts/proto/market_data.proto

export const packageName = "dexera.market_data.v1";
export const serviceName = "MarketDataService";

export interface PingRequest {
  request_id: string;
}

export interface PingReply {
  message: string;
  service: string;
}

export type HealthRequest = Record<string, never>;

export interface HealthReply {
  status: string;
  service: string;
}

export interface MarketDataServiceClient {
  ping(input: PingRequest): Promise<PingReply>;
  health(input: HealthRequest): Promise<HealthReply>;
}
