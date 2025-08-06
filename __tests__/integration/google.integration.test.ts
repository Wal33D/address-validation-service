import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

describe('Google Maps API Integration Tests', () => {
  let mock: MockAdapter;
  const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('Google Maps Geocoding', () => {
    const mockGeocodingResponse = {
      results: [
        {
          formatted_address: '1600 Pennsylvania Avenue NW, Washington, DC 20500, USA',
          geometry: {
            location: {
              lat: 38.8976763,
              lng: -77.0365298,
            },
            location_type: 'ROOFTOP',
          },
          address_components: [
            {
              long_name: '1600',
              short_name: '1600',
              types: ['street_number'],
            },
            {
              long_name: 'Pennsylvania Avenue Northwest',
              short_name: 'Pennsylvania Avenue NW',
              types: ['route'],
            },
            {
              long_name: 'Washington',
              short_name: 'Washington',
              types: ['locality', 'political'],
            },
            {
              long_name: 'District of Columbia',
              short_name: 'DC',
              types: ['administrative_area_level_1', 'political'],
            },
            {
              long_name: 'United States',
              short_name: 'US',
              types: ['country', 'political'],
            },
            {
              long_name: '20500',
              short_name: '20500',
              types: ['postal_code'],
            },
          ],
          place_id: 'ChIJGVtI4by3t4kRr51d_Qm_x58',
        },
      ],
      status: 'OK',
    };

    it('should successfully geocode an address', async () => {
      mock.onGet(GOOGLE_GEOCODING_URL).reply(200, mockGeocodingResponse);

      const response = await axios.get(GOOGLE_GEOCODING_URL, {
        params: {
          address: '1600 Pennsylvania Avenue NW, Washington, DC',
          key: 'test-api-key',
        },
      });

      expect(response.data.status).toBe('OK');
      expect(response.data.results[0].geometry.location.lat).toBeCloseTo(38.8976763);
      expect(response.data.results[0].geometry.location.lng).toBeCloseTo(-77.0365298);
    });

    it('should handle zero results', async () => {
      mock.onGet(GOOGLE_GEOCODING_URL).reply(200, {
        results: [],
        status: 'ZERO_RESULTS',
      });

      const response = await axios.get(GOOGLE_GEOCODING_URL, {
        params: {
          address: 'Nonexistent Address 12345',
          key: 'test-api-key',
        },
      });

      expect(response.data.status).toBe('ZERO_RESULTS');
      expect(response.data.results).toHaveLength(0);
    });

    it('should handle API key errors', async () => {
      mock.onGet(GOOGLE_GEOCODING_URL).reply(200, {
        error_message: 'The provided API key is invalid.',
        results: [],
        status: 'REQUEST_DENIED',
      });

      const response = await axios.get(GOOGLE_GEOCODING_URL, {
        params: {
          address: '1600 Pennsylvania Avenue',
          key: 'invalid-key',
        },
      });

      expect(response.data.status).toBe('REQUEST_DENIED');
      expect(response.data.error_message).toContain('API key is invalid');
    });

    it('should handle rate limiting', async () => {
      mock.onGet(GOOGLE_GEOCODING_URL).reply(200, {
        error_message: 'You have exceeded your daily request quota for this API.',
        results: [],
        status: 'OVER_QUERY_LIMIT',
      });

      const response = await axios.get(GOOGLE_GEOCODING_URL, {
        params: {
          address: 'Test Address',
          key: 'test-api-key',
        },
      });

      expect(response.data.status).toBe('OVER_QUERY_LIMIT');
      expect(response.data.error_message).toContain('exceeded your daily request quota');
    });

    it('should handle network errors', async () => {
      mock.onGet(GOOGLE_GEOCODING_URL).networkError();

      await expect(
        axios.get(GOOGLE_GEOCODING_URL, {
          params: { address: 'Test', key: 'test-key' },
        })
      ).rejects.toThrow('Network Error');
    });
  });

  describe('Google Maps Reverse Geocoding', () => {
    const mockReverseGeocodingResponse = {
      results: [
        {
          formatted_address: '350 5th Ave, New York, NY 10118, USA',
          address_components: [
            {
              long_name: '350',
              short_name: '350',
              types: ['street_number'],
            },
            {
              long_name: '5th Avenue',
              short_name: '5th Ave',
              types: ['route'],
            },
            {
              long_name: 'Midtown South',
              short_name: 'Midtown South',
              types: ['neighborhood', 'political'],
            },
            {
              long_name: 'Manhattan',
              short_name: 'Manhattan',
              types: ['sublocality_level_1', 'sublocality', 'political'],
            },
            {
              long_name: 'New York',
              short_name: 'New York',
              types: ['locality', 'political'],
            },
            {
              long_name: 'New York County',
              short_name: 'New York County',
              types: ['administrative_area_level_2', 'political'],
            },
            {
              long_name: 'New York',
              short_name: 'NY',
              types: ['administrative_area_level_1', 'political'],
            },
            {
              long_name: '10118',
              short_name: '10118',
              types: ['postal_code'],
            },
          ],
          geometry: {
            location: {
              lat: 40.7484445,
              lng: -73.9856644,
            },
          },
        },
      ],
      status: 'OK',
    };

    it('should successfully reverse geocode coordinates', async () => {
      mock.onGet(GOOGLE_GEOCODING_URL).reply(200, mockReverseGeocodingResponse);

      const response = await axios.get(GOOGLE_GEOCODING_URL, {
        params: {
          latlng: '40.7484445,-73.9856644',
          key: 'test-api-key',
        },
      });

      expect(response.data.status).toBe('OK');
      expect(response.data.results[0].formatted_address).toContain('350 5th Ave');
      expect(response.data.results[0].address_components).toBeDefined();
    });
  });

  describe('Response Parsing', () => {
    it('should extract county from address components', () => {
      const components = [
        { long_name: 'New York County', types: ['administrative_area_level_2'] },
        { long_name: 'New York', types: ['administrative_area_level_1'] },
      ];

      const county = components.find(c =>
        c.types.includes('administrative_area_level_2')
      )?.long_name;

      expect(county).toBe('New York County');
    });

    it('should handle missing county gracefully', () => {
      const components = [
        { long_name: 'Washington', types: ['locality'] },
        { long_name: 'DC', types: ['administrative_area_level_1'] },
      ];

      const county =
        components.find(c => c.types.includes('administrative_area_level_2'))?.long_name || null;

      expect(county).toBeNull();
    });

    it('should format coordinates correctly', () => {
      const location = { lat: 40.7484445, lng: -73.9856644 };
      const coordinates = [location.lng, location.lat];

      expect(coordinates).toEqual([-73.9856644, 40.7484445]);
    });
  });
});
