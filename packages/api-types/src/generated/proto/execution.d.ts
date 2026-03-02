export declare const packageName = "dexera.execution.v1";
export declare const serviceName = "ExecutionService";
export interface PingRequest {
    request_id: string;
}
export interface PingReply {
    message: string;
    service: string;
}
export interface HealthRequest {
}
export interface HealthReply {
    status: string;
    service: string;
}
export interface ExecutionServiceClient {
    ping(input: PingRequest): Promise<PingReply>;
    health(input: HealthRequest): Promise<HealthReply>;
}
//# sourceMappingURL=execution.d.ts.map