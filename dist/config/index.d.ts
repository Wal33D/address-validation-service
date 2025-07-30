interface Config {
    port: number;
    nodeEnv: string;
    usps: {
        tokenUrl: string;
        addressUrl: string;
        consumerKey: string;
        consumerSecret: string;
    };
    googleMaps: {
        apiKey: string;
    };
    security: {
        enableRateLimiting: boolean;
        rateLimitWindowMs: number;
        rateLimitMaxRequests: number;
        corsAllowedOrigins: string[];
    };
    cache: {
        geocodingCacheSize: number;
        geocodingCacheTTL: number;
    };
    logging: {
        level: string;
    };
}
export declare const config: Config;
export {};
//# sourceMappingURL=index.d.ts.map