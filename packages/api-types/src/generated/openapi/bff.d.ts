export type BffPublicPath = '/health' | '/api/v1/placeholder';
export declare const BFF_PUBLIC_PATHS: readonly ["/health", "/api/v1/placeholder"];
export interface BffHealthResponse {
    status: 'ok';
    service: string;
    timestamp: string;
}
export interface BffPlaceholderResponse {
    message: string;
    source: string;
}
export declare const BFF_OPENAPI_INFO: {
    readonly title: "Dexera BFF API";
    readonly version: "0.1.0";
};
//# sourceMappingURL=bff.d.ts.map