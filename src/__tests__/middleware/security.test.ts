import helmet from 'helmet';
import { securityMiddleware } from '../../middleware/security';

// Mock helmet
jest.mock('helmet', () => ({
    default: jest.fn(() => []),
    contentSecurityPolicy: jest.fn(() => jest.fn()),
    hsts: jest.fn(() => jest.fn())
}));

describe('Security Middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });


    describe('securityMiddleware', () => {
        it('should return array of security middleware', () => {
            const middlewares = securityMiddleware();
            
            expect(Array.isArray(middlewares)).toBe(true);
            expect(middlewares.length).toBeGreaterThan(0);
            expect(helmet).toHaveBeenCalled();
            expect(helmet.contentSecurityPolicy).toHaveBeenCalled();
            expect(helmet.hsts).toHaveBeenCalled();
        });

        it('should configure CSP correctly', () => {
            securityMiddleware();

            expect(helmet.contentSecurityPolicy).toHaveBeenCalledWith({
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    scriptSrc: ["'self'"],
                    imgSrc: ["'self'", "data:", "https:"],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                }
            });
        });

        it('should configure HSTS correctly', () => {
            securityMiddleware();

            expect(helmet.hsts).toHaveBeenCalledWith({
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            });
        });
    });
});