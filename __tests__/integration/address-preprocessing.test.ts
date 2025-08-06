import { correctAddress } from '../../src/server';
import { addressPreprocessor } from '../../src/utils/AddressPreprocessor';

// Mock modules
jest.mock('../../src/utils/logger');
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      response: {
        use: jest.fn((_successHandler, _errorHandler) => {
          // Store handlers but don't call them during tests
          return 1;
        }),
      },
    },
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() =>
      Promise.resolve({ data: { access_token: 'test-token', expires_in: 3600 } })
    ),
  })),
}));

// Mock the deduplicator and circuit breaker
jest.mock('../../src/utils/RequestDeduplicator', () => ({
  uspsDeduplicator: {
    execute: jest.fn((_key, fn) => fn()),
  },
  googleMapsDeduplicator: {
    execute: jest.fn((_key, fn) => fn()),
  },
}));

jest.mock('../../src/utils/CircuitBreaker', () => ({
  uspsCircuitBreaker: {
    execute: jest.fn(fn => fn()),
  },
  googleMapsCircuitBreaker: {
    execute: jest.fn(fn => fn()),
  },
}));

describe('Address Preprocessing Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should preprocess street address abbreviations before USPS API call', async () => {
    // Spy on preprocessAddress method
    const preprocessSpy = jest.spyOn(addressPreprocessor, 'preprocessAddress');

    // Mock getUSPSToken to return a valid token
    jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token', expires_in: 3600 }),
      } as any)
    );

    // Test with address that needs preprocessing
    const input = {
      streetAddress: '6470 S Stony Road',
      city: 'Monroe',
      state: 'MI',
      zipCode: '48162',
    };

    // Call correctAddress (don't await to avoid actual API call)
    void correctAddress(input);

    // Verify preprocessing was called
    expect(preprocessSpy).toHaveBeenCalledWith({
      streetAddress: '6470 S Stony Road',
      city: 'Monroe',
      state: 'MI',
      zipCode: '48162',
    });

    // Verify the preprocessing result
    const preprocessedResult = preprocessSpy.mock.results[0]?.value;
    expect(preprocessedResult?.streetAddress).toBe('6470 S. Stony Road');
    expect(preprocessedResult?.state).toBe('MI');

    // Clean up
    preprocessSpy.mockRestore();
  });

  it('should handle city corrections during preprocessing', async () => {
    const preprocessSpy = jest.spyOn(addressPreprocessor, 'preprocessAddress');

    const input = {
      streetAddress: '123 Main Street',
      city: 'St Joseph',
      state: 'MI',
      zipCode: '49085',
    };

    // Mock the USPS token
    jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token', expires_in: 3600 }),
      } as any)
    );

    // Start the correction (don't await)
    void correctAddress(input);

    // Verify preprocessing was called and city was corrected
    expect(preprocessSpy).toHaveBeenCalled();
    const preprocessedResult = preprocessSpy.mock.results[0]?.value;
    expect(preprocessedResult?.city).toBe('Saint Joseph');

    preprocessSpy.mockRestore();
  });

  it('should use ZIP-to-city mapping when city is invalid', async () => {
    const preprocessSpy = jest.spyOn(addressPreprocessor, 'preprocessAddress');

    const input = {
      streetAddress: '2029 Ridge Street',
      city: 'McBride',
      state: 'MI',
      zipCode: '48852',
    };

    // Mock the USPS token
    jest.spyOn(global, 'fetch').mockImplementation(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token', expires_in: 3600 }),
      } as any)
    );

    // Start the correction (don't await)
    void correctAddress(input);

    // Verify preprocessing corrected the invalid city
    expect(preprocessSpy).toHaveBeenCalled();
    const preprocessedResult = preprocessSpy.mock.results[0]?.value;
    expect(preprocessedResult?.city).toBe('Mount Pleasant');

    preprocessSpy.mockRestore();
  });
});
