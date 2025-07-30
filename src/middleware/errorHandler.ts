import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

// Error handler middleware
export function errorHandler(
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction
): void {
    // If headers have already been sent, we can't send an error response
    if (res.headersSent) {
        return;
    }
    
    // Log the error
    logger.error({
        message: err.message,
        stack: err.stack,
        ...(err instanceof AppError && { statusCode: err.statusCode })
    });
    
    // Default error values
    let statusCode = 500;
    let message = 'Internal server error';
    let isOperational = false;
    
    if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        isOperational = err.isOperational;
    } else if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Invalid input data';
        isOperational = true;
    } else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid data format';
        isOperational = true;
    }
    
    // Send error response
    res.status(statusCode).json({
        error: {
            message: isOperational ? message : 'Something went wrong',
            ...(process.env['NODE_ENV'] === 'development' && {
                stack: err.stack,
                details: err
            })
        },
        status: false
    });
    
    // For non-operational errors in production, we might want to shut down
    if (!isOperational && process.env['NODE_ENV'] === 'production') {
        logger.error('Non-operational error occurred, consider shutting down gracefully');
    }
}

// Async error wrapper
export function asyncHandler(fn: Function) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// Not found handler
export function notFoundHandler(_req: Request, res: Response): void {
    res.status(404).json({
        error: {
            message: 'Endpoint not found'
        },
        status: false
    });
}