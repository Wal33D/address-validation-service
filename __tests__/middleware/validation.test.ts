import { Request, Response, NextFunction } from 'express';
import { validate, validateLocationRequest, schemas } from '../../src/middleware/validation';
import { ValidationError } from '../../src/utils/errors';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockReq = {
      body: {},
    };
    mockRes = {};
    mockNext = jest.fn() as jest.MockedFunction<NextFunction>;
  });

  describe('validate middleware factory', () => {
    it('should pass valid data', () => {
      const middleware = validate(schemas.coordinates);
      mockReq.body = { lat: 40.7128, lng: -74.006 };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({ lat: 40.7128, lng: -74.006 });
    });

    it('should throw ValidationError for invalid data', () => {
      const middleware = validate(schemas.coordinates);
      mockReq.body = { lat: 'invalid', lng: -74.006 };

      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(ValidationError);
    });

    it('should strip unknown fields', () => {
      const middleware = validate(schemas.coordinates);
      mockReq.body = {
        lat: 40.7128,
        lng: -74.006,
        unknownField: 'should be removed',
      };

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body).toEqual({ lat: 40.7128, lng: -74.006 });
      expect(mockReq.body).not.toHaveProperty('unknownField');
    });
  });

  describe('validateLocation schema', () => {
    it('should validate complete location data', () => {
      mockReq.body = {
        streetAddress: '123 Main St',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        geo: {
          type: 'Point',
          coordinates: [-74.006, 40.7128],
        },
      };

      validateLocationRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should require streetAddress', () => {
      mockReq.body = {
        city: 'New York',
        state: 'NY',
      };

      expect(() => {
        validateLocationRequest(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(ValidationError);
    });

    it('should require either city or zipCode', () => {
      mockReq.body = {
        streetAddress: '123 Main St',
        state: 'NY',
      };

      expect(() => {
        validateLocationRequest(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(ValidationError);
    });

    it('should validate state as 2-letter uppercase', () => {
      mockReq.body = {
        streetAddress: '123 Main St',
        city: 'New York',
        state: 'ny', // lowercase
      };

      validateLocationRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.body.state).toBe('NY'); // Should be uppercase
    });

    it('should validate zipCode format', () => {
      mockReq.body = {
        streetAddress: '123 Main St',
        zipCode: 'invalid',
      };

      expect(() => {
        validateLocationRequest(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(ValidationError);
    });

    it('should accept zipCode with +4', () => {
      mockReq.body = {
        streetAddress: '123 Main St',
        zipCode: '10001-1234',
      };

      validateLocationRequest(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should validate geo coordinates', () => {
      mockReq.body = {
        streetAddress: '123 Main St',
        city: 'New York',
        geo: {
          type: 'Point',
          coordinates: [-74.006], // Missing one coordinate
        },
      };

      expect(() => {
        validateLocationRequest(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(ValidationError);
    });
  });

  describe('coordinates schema', () => {
    it('should validate US territory bounds', () => {
      const testCases = [
        { lat: 17, lng: -74, shouldFail: true }, // Too far south
        { lat: 73, lng: -74, shouldFail: true }, // Too far north
        { lat: 40, lng: -64, shouldFail: true }, // Too far east
        { lat: 40, lng: -181, shouldFail: true }, // Too far west
        { lat: 40.7128, lng: -74.006, shouldFail: false }, // Valid NYC
        { lat: 21.3099, lng: -157.8581, shouldFail: false }, // Valid Hawaii
        { lat: 64.0685, lng: -141.0056, shouldFail: false }, // Valid Alaska
      ];

      testCases.forEach(({ lat, lng, shouldFail }) => {
        const middleware = validate(schemas.coordinates);
        mockReq.body = { lat, lng };

        if (shouldFail) {
          expect(() => {
            middleware(mockReq as Request, mockRes as Response, mockNext);
          }).toThrow(ValidationError);
        } else {
          middleware(mockReq as Request, mockRes as Response, mockNext);
          expect(mockNext).toHaveBeenCalled();
        }

        mockNext.mockClear();
      });
    });
  });
});
