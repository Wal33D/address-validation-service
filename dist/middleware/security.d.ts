import cors from 'cors';
export declare const corsOptions: cors.CorsOptions;
export declare const createRateLimiter: (windowMs?: number, max?: number) => import("express-rate-limit").RateLimitRequestHandler;
export declare const securityMiddleware: () => (import("express-rate-limit").RateLimitRequestHandler | ((req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void) | ((req: cors.CorsRequest, res: {
    statusCode?: number | undefined;
    setHeader(key: string, value: string): any;
    end(): any;
}, next: (err?: any) => any) => void))[];
//# sourceMappingURL=security.d.ts.map