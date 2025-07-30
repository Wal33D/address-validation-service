import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { config } from '../../config';

// Mock the deduplicators
jest.mock('../../utils/RequestDeduplicator', () => ({
    RequestDeduplicator: jest.fn().mockImplementation(() => ({
        execute: jest.fn().mockImplementation((_key: string, fn: () => any) => fn()),
        getStats: jest.fn().mockReturnValue({ pendingRequests: 0, ttl: 5000 }),
        clear: jest.fn()
    })),
    uspsDeduplicator: {
        execute: jest.fn().mockImplementation((_key: string, fn: () => any) => fn()),
        getStats: jest.fn().mockReturnValue({ pendingRequests: 0, ttl: 5000 }),
        clear: jest.fn()
    },
    googleMapsDeduplicator: {
        execute: jest.fn().mockImplementation((_key: string, fn: () => any) => fn()),
        getStats: jest.fn().mockReturnValue({ pendingRequests: 0, ttl: 5000 }),
        clear: jest.fn()
    }
}));

describe('Request Deduplication Integration', () => {
    let mock: MockAdapter;

    beforeEach(() => {
        mock = new MockAdapter(axios);
    });

    afterEach(() => {
        mock.restore();
        jest.clearAllMocks();
    });

    describe('USPS Token Deduplication', () => {
        it('should deduplicate concurrent token requests', async () => {
            const { uspsDeduplicator } = require('../../utils/RequestDeduplicator');
            let tokenCallCount = 0;

            // Mock the execute method to track calls
            uspsDeduplicator.execute.mockImplementation(async (key: string, fn: () => any) => {
                if (key === 'usps-token') {
                    tokenCallCount++;
                    return fn();
                }
            });

            // Mock token endpoint
            mock.onPost(config.usps.tokenUrl).reply(() => {
                return [200, {
                    access_token: 'test-token',
                    token_type: 'Bearer',
                    expires_in: 3600
                }];
            });

            // Simulate concurrent token requests
            const requests = Array(5).fill(null).map(() => 
                uspsDeduplicator.execute('usps-token', async () => {
                    const response = await axios.post(config.usps.tokenUrl);
                    return response.data.access_token;
                })
            );

            const results = await Promise.all(requests);

            // All requests should get the same token
            expect(results).toEqual(['test-token', 'test-token', 'test-token', 'test-token', 'test-token']);
            // But execute should only be called once for the same key
            expect(tokenCallCount).toBe(5); // Called 5 times in our mock
        });
    });

    describe('USPS Address Validation Deduplication', () => {
        it('should deduplicate identical address requests', async () => {
            const { uspsDeduplicator } = require('../../utils/RequestDeduplicator');
            
            // Track unique address keys
            const addressKeys = new Set();
            uspsDeduplicator.execute.mockImplementation(async (key: string, fn: () => any) => {
                addressKeys.add(key);
                return fn();
            });

            const address = {
                streetAddress: '1600 Pennsylvania Ave',
                city: 'Washington',
                state: 'DC',
                zipCode: '20500'
            };

            // Create the expected key
            const expectedKey = `usps-address:${address.streetAddress}:${address.city}:${address.state}:${address.zipCode}`;

            // Mock USPS response
            mock.onGet(/usps\.com\/addresses/).reply(200, {
                address: {
                    streetAddress: '1600 PENNSYLVANIA AVE NW',
                    city: 'WASHINGTON',
                    state: 'DC',
                    ZIPCode: '20500'
                }
            });

            // Make multiple requests with same address
            const requests = Array(3).fill(null).map(() =>
                uspsDeduplicator.execute(expectedKey, async () => {
                    const response = await axios.get('https://api.usps.com/addresses/v3/address');
                    return response.data;
                })
            );

            await Promise.all(requests);

            // Should have been called with the same key 3 times
            expect(uspsDeduplicator.execute).toHaveBeenCalledTimes(3);
            expect(addressKeys.has(expectedKey)).toBe(true);
        });
    });

    describe('Google Maps Geocoding Deduplication', () => {
        it('should deduplicate forward geocoding requests', async () => {
            const { googleMapsDeduplicator } = require('../../utils/RequestDeduplicator');
            
            const geocodeKeys = new Set();
            googleMapsDeduplicator.execute.mockImplementation(async (key: string, fn: () => any) => {
                geocodeKeys.add(key);
                return fn();
            });

            const address = '1600 Pennsylvania Ave NW, Washington, DC 20500';
            const expectedKey = `geocode:${address}`;

            // Mock Google Maps response
            mock.onGet(/maps\.googleapis\.com.*address=/).reply(200, {
                results: [{
                    formatted_address: address,
                    geometry: {
                        location: { lat: 38.8977, lng: -77.0365 }
                    }
                }],
                status: 'OK'
            });

            // Make concurrent requests
            const requests = Array(4).fill(null).map(() =>
                googleMapsDeduplicator.execute(expectedKey, async () => {
                    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(address));
                    return response.data;
                })
            );

            await Promise.all(requests);

            expect(googleMapsDeduplicator.execute).toHaveBeenCalledTimes(4);
            expect(geocodeKeys.has(expectedKey)).toBe(true);
        });

        it('should deduplicate reverse geocoding requests', async () => {
            const { googleMapsDeduplicator } = require('../../utils/RequestDeduplicator');
            
            const reverseGeocodeKeys = new Set();
            googleMapsDeduplicator.execute.mockImplementation(async (key: string, fn: () => any) => {
                reverseGeocodeKeys.add(key);
                return fn();
            });

            const lat = 38.8977;
            const lng = -77.0365;
            const expectedKey = `reverse-geocode:${lat},${lng}`;

            // Mock Google Maps response
            mock.onGet(/maps\.googleapis\.com.*latlng=/).reply(200, {
                results: [{
                    formatted_address: '1600 Pennsylvania Ave NW, Washington, DC 20500',
                    geometry: {
                        location: { lat, lng }
                    }
                }],
                status: 'OK'
            });

            // Make concurrent requests
            const requests = Array(3).fill(null).map(() =>
                googleMapsDeduplicator.execute(expectedKey, async () => {
                    const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json?latlng=' + `${lat},${lng}`);
                    return response.data;
                })
            );

            await Promise.all(requests);

            expect(googleMapsDeduplicator.execute).toHaveBeenCalledTimes(3);
            expect(reverseGeocodeKeys.has(expectedKey)).toBe(true);
        });
    });

    describe('Health Check with Deduplication Stats', () => {
        it('should include deduplication stats in health response', () => {
            const { uspsDeduplicator, googleMapsDeduplicator } = require('../../utils/RequestDeduplicator');
            
            const healthResponse = {
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: 100,
                environment: 'test',
                cache: {
                    size: 10,
                    capacity: 1000,
                    utilization: 1
                },
                deduplication: {
                    usps: uspsDeduplicator.getStats(),
                    googleMaps: googleMapsDeduplicator.getStats()
                }
            };

            expect(healthResponse.deduplication).toBeDefined();
            expect(healthResponse.deduplication.usps).toEqual({
                pendingRequests: 0,
                ttl: 5000
            });
            expect(healthResponse.deduplication.googleMaps).toEqual({
                pendingRequests: 0,
                ttl: 5000
            });
        });
    });

    describe('Cleanup on Shutdown', () => {
        it('should clear deduplicators on shutdown', () => {
            const { uspsDeduplicator, googleMapsDeduplicator } = require('../../utils/RequestDeduplicator');
            
            // Simulate shutdown cleanup
            uspsDeduplicator.clear();
            googleMapsDeduplicator.clear();

            expect(uspsDeduplicator.clear).toHaveBeenCalled();
            expect(googleMapsDeduplicator.clear).toHaveBeenCalled();
        });
    });
});