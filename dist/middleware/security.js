"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityMiddleware = exports.createRateLimiter = exports.corsOptions = void 0;
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const logger_1 = __importDefault(require("../utils/logger"));
exports.corsOptions = {
    origin: process.env['CORS_ALLOWED_ORIGINS']?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200
};
const createRateLimiter = (windowMs = 60000, max = 100) => {
    return (0, express_rate_limit_1.default)({
        windowMs,
        max,
        message: 'Too many requests from this IP, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req, res) => {
            logger_1.default.warn('Rate limit exceeded');
            res.status(429).json({
                error: {
                    message: 'Too many requests, please try again later'
                },
                status: false
            });
        },
        skip: (req) => {
            const clientIp = (req.ip || '').replace(/^::ffff:/, '');
            return ['127.0.0.1', '::1'].includes(clientIp);
        }
    });
};
exports.createRateLimiter = createRateLimiter;
const securityMiddleware = () => {
    const middlewares = [];
    middlewares.push((0, helmet_1.default)({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    }));
    middlewares.push((0, cors_1.default)(exports.corsOptions));
    if (process.env['ENABLE_RATE_LIMITING'] !== 'false') {
        const windowMs = parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '60000');
        const maxRequests = parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100');
        middlewares.push((0, exports.createRateLimiter)(windowMs, maxRequests));
    }
    return middlewares;
};
exports.securityMiddleware = securityMiddleware;
//# sourceMappingURL=security.js.map