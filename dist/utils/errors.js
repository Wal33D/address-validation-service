"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeoutError = exports.RateLimitError = exports.GoogleMapsError = exports.USPSError = exports.ExternalAPIError = exports.NotFoundError = exports.ForbiddenError = exports.AuthenticationError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    statusCode;
    isOperational;
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}
exports.ValidationError = ValidationError;
class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
    }
}
exports.AuthenticationError = AuthenticationError;
class ForbiddenError extends AppError {
    constructor(message = 'Access denied') {
        super(message, 403);
    }
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}
exports.NotFoundError = NotFoundError;
class ExternalAPIError extends AppError {
    service;
    constructor(service, message, statusCode = 502) {
        super(`${service} API Error: ${message}`, statusCode);
        this.service = service;
    }
}
exports.ExternalAPIError = ExternalAPIError;
class USPSError extends ExternalAPIError {
    constructor(message) {
        super('USPS', message);
    }
}
exports.USPSError = USPSError;
class GoogleMapsError extends ExternalAPIError {
    constructor(message) {
        super('Google Maps', message);
    }
}
exports.GoogleMapsError = GoogleMapsError;
class RateLimitError extends AppError {
    constructor(message = 'Too many requests') {
        super(message, 429);
    }
}
exports.RateLimitError = RateLimitError;
class TimeoutError extends AppError {
    constructor(service) {
        super(`Request to ${service} timed out`, 504);
    }
}
exports.TimeoutError = TimeoutError;
//# sourceMappingURL=errors.js.map