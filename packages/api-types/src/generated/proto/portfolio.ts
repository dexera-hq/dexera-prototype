// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: contracts/proto/portfolio.proto

export const packageName = "dexera.portfolio.v1";
export const serviceName = "PortfolioService";

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

export interface PortfolioServiceClient {
  ping(input: PingRequest): Promise<PingReply>;
  health(input: HealthRequest): Promise<HealthReply>;
}
