import { Request, Response, NextFunction } from 'express';
import { errorHandler, asyncHandler } from '../../middleware/errorHandler';
import { 
    AppError, 
    ValidationError, 
    AuthenticationError,
    ForbiddenError,
    NotFoundError,
    ExternalAPIError
} from '../../utils/errors';
import logger from '../../utils/logger';

// Mock logger
jest.mock('../../utils/logger', () => ({
    __esModule: true,
    default: {
        error: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        debug: jest.fn()
    }
}));

describe('Error Handler Middleware', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
        mockReq = {
            method: 'GET',
            url: '/test',
            ip: '127.0.0.1'
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            headersSent: false
        };
        mockNext = jest.fn();
        jest.clearAllMocks();
    });

    describe('errorHandler', () => {
        it('should handle ValidationError correctly', () => {
            const error = new ValidationError('Invalid input');
            
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid input',
                status: 400
            });
        });

        it('should handle AuthenticationError correctly', () => {
            const error = new AuthenticationError();
            
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Authentication required',
                status: 401
            });
        });

        it('should handle ForbiddenError correctly', () => {
            const error = new ForbiddenError('Access denied');
            
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Access denied',
                status: 403
            });
        });

        it('should handle NotFoundError correctly', () => {
            const error = new NotFoundError('Resource not found');
            
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Resource not found',
                status: 404
            });
        });

        it('should handle ExternalAPIError correctly', () => {
            const error = new ExternalAPIError('USPS', 'Service unavailable');
            
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(502);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'USPS error: Service unavailable',
                status: 502
            });
        });

        it('should handle generic errors in production', () => {
            process.env['NODE_ENV'] = 'production';
            const error = new Error('Sensitive error message');
            
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Internal server error',
                status: 500
            });
        });

        it('should handle generic errors in development', () => {
            process.env['NODE_ENV'] = 'development';
            const error = new Error('Debug error message');
            
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Debug error message',
                status: 500,
                stack: expect.any(String)
            });
        });

        it('should pass to next if headers already sent', () => {
            mockRes.headersSent = true;
            const error = new Error('Test error');
            
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith(error);
            expect(mockRes.status).not.toHaveBeenCalled();
            expect(mockRes.json).not.toHaveBeenCalled();
        });

        it('should log errors with request details', () => {
            const error = new AppError('Test error', 500);
            
            errorHandler(error, mockReq as Request, mockRes as Response, mockNext);

            expect(logger.error).toHaveBeenCalledWith('Request error', {
                error: 'Test error',
                statusCode: 500,
                method: 'GET',
                url: '/test',
                ip: '127.0.0.1',
                stack: expect.any(String)
            });
        });
    });

    describe('asyncHandler', () => {
        it('should handle successful async functions', async () => {
            const asyncFn = jest.fn().mockResolvedValue('success');
            const wrapped = asyncHandler(asyncFn);

            await wrapped(mockReq as Request, mockRes as Response, mockNext);

            expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should catch and forward async errors', async () => {
            const error = new Error('Async error');
            const asyncFn = jest.fn().mockRejectedValue(error);
            const wrapped = asyncHandler(asyncFn);

            await wrapped(mockReq as Request, mockRes as Response, mockNext);

            expect(asyncFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledWith(error);
        });

        it('should handle sync errors in async functions', async () => {
            const error = new Error('Sync error in async');
            const asyncFn = jest.fn(() => {
                throw error;
            });
            const wrapped = asyncHandler(asyncFn);

            await wrapped(mockReq as Request, mockRes as Response, mockNext);

            expect(mockNext).toHaveBeenCalledWith(error);
        });
    });
});