"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.asyncHandler = asyncHandler;
exports.notFoundHandler = notFoundHandler;
const logger_1 = __importDefault(require("../utils/logger"));
const errors_1 = require("../utils/errors");
function errorHandler(err, _req, res, _next) {
    logger_1.default.error({
        message: err.message,
        stack: err.stack,
        ...(err instanceof errors_1.AppError && { statusCode: err.statusCode })
    });
    let statusCode = 500;
    let message = 'Internal server error';
    let isOperational = false;
    if (err instanceof errors_1.AppError) {
        statusCode = err.statusCode;
        message = err.message;
        isOperational = err.isOperational;
    }
    else if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Invalid input data';
        isOperational = true;
    }
    else if (err.name === 'CastError') {
        statusCode = 400;
        message = 'Invalid data format';
        isOperational = true;
    }
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
    if (!isOperational && process.env['NODE_ENV'] === 'production') {
        logger_1.default.error('Non-operational error occurred, consider shutting down gracefully');
    }
}
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
function notFoundHandler(_req, res) {
    res.status(404).json({
        error: {
            message: 'Endpoint not found'
        },
        status: false
    });
}
//# sourceMappingURL=errorHandler.js.map