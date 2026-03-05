// AUTO-GENERATED FILE. DO NOT EDIT.
// Source: contracts/proto/execution.proto

export const packageName = "dexera.execution.v1";
export const serviceName = "ExecutionService";

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

export interface ExecutionServiceClient {
  ping(input: PingRequest): Promise<PingReply>;
  health(input: HealthRequest): Promise<HealthReply>;
}
