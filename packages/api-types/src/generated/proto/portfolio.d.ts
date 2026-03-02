export declare const packageName = "dexera.portfolio.v1";
export declare const serviceName = "PortfolioService";
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
export interface PortfolioServiceClient {
    ping(input: PingRequest): Promise<PingReply>;
    health(input: HealthRequest): Promise<HealthReply>;
}
//# sourceMappingURL=portfolio.d.ts.map