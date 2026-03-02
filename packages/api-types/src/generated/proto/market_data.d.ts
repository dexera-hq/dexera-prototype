export declare const packageName = "dexera.market_data.v1";
export declare const serviceName = "MarketDataService";
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
export interface MarketDataServiceClient {
    ping(input: PingRequest): Promise<PingReply>;
    health(input: HealthRequest): Promise<HealthReply>;
}
//# sourceMappingURL=market_data.d.ts.map