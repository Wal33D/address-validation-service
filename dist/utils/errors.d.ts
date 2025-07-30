export declare class AppError extends Error {
    readonly statusCode: number;
    readonly isOperational: boolean;
    constructor(message: string, statusCode?: number, isOperational?: boolean);
}
export declare class ValidationError extends AppError {
    constructor(message: string);
}
export declare class AuthenticationError extends AppError {
    constructor(message?: string);
}
export declare class ForbiddenError extends AppError {
    constructor(message?: string);
}
export declare class NotFoundError extends AppError {
    constructor(message?: string);
}
export declare class ExternalAPIError extends AppError {
    readonly service: string;
    constructor(service: string, message: string, statusCode?: number);
}
export declare class USPSError extends ExternalAPIError {
    constructor(message: string);
}
export declare class GoogleMapsError extends ExternalAPIError {
    constructor(message: string);
}
export declare class RateLimitError extends AppError {
    constructor(message?: string);
}
export declare class TimeoutError extends AppError {
    constructor(service: string);
}
//# sourceMappingURL=errors.d.ts.map