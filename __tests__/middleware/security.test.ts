import helmet from 'helmet';
import { securityMiddleware } from '../../src/middleware/security';

// Mock helmet
jest.mock('helmet', () => {
  return {
    __esModule: true,
    default: jest.fn(() => []),
  };
});

describe('Security Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('securityMiddleware', () => {
    it('should return array of security middleware', () => {
      const middlewares = securityMiddleware();

      expect(Array.isArray(middlewares)).toBe(true);
      expect(middlewares.length).toBeGreaterThan(0);
      expect(helmet).toHaveBeenCalledWith({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false,
      });
    });

    it('should include CORS middleware', () => {
      const middlewares = securityMiddleware();
      expect(middlewares.length).toBeGreaterThanOrEqual(2); // At least helmet and cors
    });

    it('should include rate limiting when enabled', () => {
      process.env['ENABLE_RATE_LIMITING'] = 'true';
      const middlewares = securityMiddleware();
      expect(middlewares.length).toBeGreaterThanOrEqual(3); // helmet, cors, and rate limiter
    });

    it('should skip rate limiting when disabled', () => {
      process.env['ENABLE_RATE_LIMITING'] = 'false';
      const middlewares = securityMiddleware();
      expect(middlewares.length).toBe(2); // Only helmet and cors
    });
  });
});
