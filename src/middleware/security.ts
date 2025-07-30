import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import logger from '../utils/logger';

// CORS configuration
export const corsOptions: cors.CorsOptions = {
    origin: process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    optionsSuccessStatus: 200
};

// Rate limiting configuration
export const createRateLimiter = (windowMs: number = 60000, max: number = 100) => {
    return rateLimit({
        windowMs,
        max,
        message: 'Too many requests from this IP, please try again later',
        standardHeaders: true,
        legacyHeaders: false,
        handler: (_req: Request, res: Response) => {
            logger.warn('Rate limit exceeded');
            res.status(429).json({
                error: {
                    message: 'Too many requests, please try again later'
                },
                status: false
            });
        },
        skip: (req: Request) => {
            // Skip rate limiting for local requests
            const clientIp = (req.ip || '').replace(/^::ffff:/, '');
            return ['127.0.0.1', '::1'].includes(clientIp);
        }
    });
};

// Security middleware configuration
export const securityMiddleware = () => {
    const middlewares = [];
    
    // Add Helmet for security headers
    middlewares.push(helmet({
        contentSecurityPolicy: false, // Disable for API
        crossOriginEmbedderPolicy: false
    }));
    
    // Add CORS
    middlewares.push(cors(corsOptions));
    
    // Add rate limiting
    if (process.env.ENABLE_RATE_LIMITING !== 'false') {
        const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
        const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
        middlewares.push(createRateLimiter(windowMs, maxRequests));
    }
    
    return middlewares;
};