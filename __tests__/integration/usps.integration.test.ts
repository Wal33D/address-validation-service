import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { config } from '../../src/config';

describe('USPS API Integration Tests', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('USPS OAuth Token', () => {
    it('should successfully obtain OAuth token', async () => {
      const mockTokenResponse = {
        access_token: 'test-token-123',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'addresses',
      };

      mock.onPost(config.usps.tokenUrl).reply(200, mockTokenResponse);

      const response = await axios.post(
        config.usps.tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: 'test-client',
          client_secret: 'test-secret',
          scope: 'addresses',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      expect(response.data.access_token).toBe('test-token-123');
      expect(response.data.expires_in).toBe(3600);
    });

    it('should handle token request failures', async () => {
      mock.onPost(config.usps.tokenUrl).reply(401, {
        error: 'invalid_client',
        error_description: 'Client authentication failed',
      });

      await expect(axios.post(config.usps.tokenUrl, {})).rejects.toThrow();
    });
  });

  describe('USPS Address Validation', () => {
    const mockValidAddress = {
      address: {
        streetAddress: '1600 PENNSYLVANIA AVE NW',
        city: 'WASHINGTON',
        state: 'DC',
        ZIPCode: '20500',
        ZIPPlus4: '0003',
      },
    };

    it('should validate a correct address', async () => {
      mock.onPost(config.usps.addressUrl).reply(200, mockValidAddress);

      const response = await axios.post(
        config.usps.addressUrl,
        {
          streetAddress: '1600 Pennsylvania Avenue',
          city: 'Washington',
          state: 'DC',
        },
        {
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.data.address.streetAddress).toBe('1600 PENNSYLVANIA AVE NW');
      expect(response.data.address.ZIPCode).toBe('20500');
    });

    it('should handle invalid address', async () => {
      mock.onPost(config.usps.addressUrl).reply(200, {
        error: {
          code: 'INVALID_ADDRESS',
          message: 'Address not found',
        },
      });

      const response = await axios.post(
        config.usps.addressUrl,
        {
          streetAddress: '123 Fake Street',
          city: 'Nowhere',
          state: 'XX',
        },
        {
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        }
      );

      expect(response.data.error).toBeDefined();
      expect(response.data.error.code).toBe('INVALID_ADDRESS');
    });

    it('should handle request timeout', async () => {
      mock.onPost(config.usps.addressUrl).timeout();

      await expect(axios.post(config.usps.addressUrl, {}, { timeout: 1000 })).rejects.toThrow();
    });

    it('should handle rate limiting', async () => {
      mock.onPost(config.usps.addressUrl).reply(429, {
        error: 'Rate limit exceeded',
        retry_after: 60,
      });

      try {
        await axios.post(config.usps.addressUrl, {});
      } catch (error: any) {
        expect(error.response.status).toBe(429);
        expect(error.response.data.error).toBe('Rate limit exceeded');
      }
    });
  });

  describe('USPS Response Parsing', () => {
    it('should correctly parse USPS address components', () => {
      const uspsResponse = {
        address: {
          streetAddress: '350 5TH AVE',
          city: 'NEW YORK',
          state: 'NY',
          ZIPCode: '10118',
          ZIPPlus4: '0110',
        },
      };

      // Parse the response
      const parsed = {
        streetAddress: uspsResponse.address.streetAddress,
        city: uspsResponse.address.city,
        state: uspsResponse.address.state,
        zipCode: `${uspsResponse.address.ZIPCode}-${uspsResponse.address.ZIPPlus4}`,
      };

      expect(parsed.streetAddress).toBe('350 5TH AVE');
      expect(parsed.city).toBe('NEW YORK');
      expect(parsed.state).toBe('NY');
      expect(parsed.zipCode).toBe('10118-0110');
    });

    it('should handle missing ZIPPlus4', () => {
      const uspsResponse: any = {
        address: {
          streetAddress: '123 MAIN ST',
          city: 'ANYTOWN',
          state: 'CA',
          ZIPCode: '90210',
        },
      };

      const zipCode = uspsResponse.address.ZIPPlus4
        ? `${uspsResponse.address.ZIPCode}-${uspsResponse.address.ZIPPlus4}`
        : uspsResponse.address.ZIPCode;

      expect(zipCode).toBe('90210');
    });
  });
});
