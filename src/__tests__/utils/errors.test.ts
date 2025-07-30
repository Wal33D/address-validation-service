import {
    AppError,
    ValidationError,
    AuthenticationError,
    ForbiddenError,
    NotFoundError,
    ExternalAPIError,
    USPSError,
    GoogleMapsError,
    RateLimitError,
    TimeoutError
} from '../../utils/errors';

describe('Error Classes', () => {
    describe('AppError', () => {
        it('should create error with default values', () => {
            const error = new AppError('Test error');
            
            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(500);
            expect(error.isOperational).toBe(true);
            expect(error.stack).toBeDefined();
        });

        it('should create error with custom values', () => {
            const error = new AppError('Custom error', 400, false);
            
            expect(error.message).toBe('Custom error');
            expect(error.statusCode).toBe(400);
            expect(error.isOperational).toBe(false);
        });
    });

    describe('ValidationError', () => {
        it('should create 400 error', () => {
            const error = new ValidationError('Invalid input');
            
            expect(error.message).toBe('Invalid input');
            expect(error.statusCode).toBe(400);
            expect(error.isOperational).toBe(true);
        });
    });

    describe('AuthenticationError', () => {
        it('should create 401 error with default message', () => {
            const error = new AuthenticationError();
            
            expect(error.message).toBe('Authentication failed');
            expect(error.statusCode).toBe(401);
        });

        it('should create 401 error with custom message', () => {
            const error = new AuthenticationError('Invalid token');
            
            expect(error.message).toBe('Invalid token');
            expect(error.statusCode).toBe(401);
        });
    });

    describe('ForbiddenError', () => {
        it('should create 403 error', () => {
            const error = new ForbiddenError();
            
            expect(error.message).toBe('Access denied');
            expect(error.statusCode).toBe(403);
        });
    });

    describe('NotFoundError', () => {
        it('should create 404 error', () => {
            const error = new NotFoundError();
            
            expect(error.message).toBe('Resource not found');
            expect(error.statusCode).toBe(404);
        });
    });

    describe('ExternalAPIError', () => {
        it('should create error with service name', () => {
            const error = new ExternalAPIError('TestAPI', 'Connection failed');
            
            expect(error.message).toBe('TestAPI API Error: Connection failed');
            expect(error.service).toBe('TestAPI');
            expect(error.statusCode).toBe(502);
        });

        it('should accept custom status code', () => {
            const error = new ExternalAPIError('TestAPI', 'Rate limited', 429);
            
            expect(error.statusCode).toBe(429);
        });
    });

    describe('USPSError', () => {
        it('should create USPS-specific error', () => {
            const error = new USPSError('Invalid address');
            
            expect(error.message).toBe('USPS API Error: Invalid address');
            expect(error.service).toBe('USPS');
            expect(error.statusCode).toBe(502);
        });
    });

    describe('GoogleMapsError', () => {
        it('should create Google Maps-specific error', () => {
            const error = new GoogleMapsError('Quota exceeded');
            
            expect(error.message).toBe('Google Maps API Error: Quota exceeded');
            expect(error.service).toBe('Google Maps');
            expect(error.statusCode).toBe(502);
        });
    });

    describe('RateLimitError', () => {
        it('should create 429 error', () => {
            const error = new RateLimitError();
            
            expect(error.message).toBe('Too many requests');
            expect(error.statusCode).toBe(429);
        });
    });

    describe('TimeoutError', () => {
        it('should create 504 error', () => {
            const error = new TimeoutError('USPS API');
            
            expect(error.message).toBe('Request to USPS API timed out');
            expect(error.statusCode).toBe(504);
        });
    });
});