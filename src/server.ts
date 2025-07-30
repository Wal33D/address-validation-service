import express, { Request, Response } from 'express';
import compression from 'compression';
import axios, { AxiosInstance } from 'axios';
import https from 'https';
import http from 'http';
import dotenv from 'dotenv';
import logger from './utils/logger';
import { LRUCache, generateGeocacheKey } from './utils/LRUCache';
import { uspsDeduplicator, googleMapsDeduplicator } from './utils/RequestDeduplicator';
import { errorHandler, asyncHandler } from './middleware/errorHandler';
import { localOnlyMiddleware } from './middleware/localOnlyMiddleware';
import { securityMiddleware } from './middleware/security';
import { validateLocationRequest } from './middleware/validation';
import { LocationReturn, Geo } from './types';
import { config } from './config';

dotenv.config();

// Initialize cache
const geocodingCache = new LRUCache<string, any>(
    config.cache.geocodingCacheSize,
    config.cache.geocodingCacheTTL
);

// Types
export interface ValidateLocationRequest {
    streetAddress: string;
    city?: string;
    state?: string;
    zipCode?: string;
    geo?: Geo;
    formattedAddress?: string;
    [key: string]: unknown;
}

interface AddressInput {
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
}

interface AddressResult {
    streetAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    formattedAddress?: string;
    unformattedAddress?: string;
}

export interface AddressCorrectionResponse {
    location: AddressResult;
    status: boolean;
    error?: string;
}

// USPS token management
let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null;

// Create HTTP/HTTPS agents with connection pooling
const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
    scheduling: 'lifo' // Last-in-first-out scheduling
});

const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 60000,
    scheduling: 'lifo',
    rejectUnauthorized: true
});

// Create axios instances with retry logic and connection pooling
const createAxiosInstance = (baseURL?: string, timeout: number = 10000): AxiosInstance => {
    const instance = axios.create({
        ...(baseURL && { baseURL }),
        timeout,
        headers: {
            'User-Agent': 'CandyComp-Location-Service/1.0'
        },
        httpAgent,
        httpsAgent,
        // Additional performance optimizations
        maxRedirects: 5,
        decompress: true,
        validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });

    // Add retry interceptor
    instance.interceptors.response.use(
        response => response,
        async error => {
            const originalRequest = error.config;
            
            if (!originalRequest._retry && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')) {
                originalRequest._retry = true;
                logger.warn(`Retrying request to ${originalRequest.url}`);
                return instance(originalRequest);
            }
            
            return Promise.reject(error);
        }
    );

    return instance;
};

const uspsAxios = createAxiosInstance(undefined, 30000);
const googleAxios = createAxiosInstance(undefined, 10000);

// Helper functions
function toTitleCase(s: string): string {
    return s
        .toLowerCase()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function cleanObject<T extends object>(obj: T): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== undefined && v !== '')
    ) as Partial<T>;
}

// USPS functions
async function getUSPSToken(): Promise<string | null> {
    if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 60000) {
        return cachedToken;
    }

    // Use deduplication for token requests
    return uspsDeduplicator.execute('usps-token', async () => {
        const body = new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: config.usps.consumerKey,
            client_secret: config.usps.consumerSecret,
            scope: 'addresses',
        });

        try {
            const response = await uspsAxios.post(
                config.usps.tokenUrl,
                body.toString(),
                {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                }
            );
            
            const data = response.data as { access_token: string; expires_in: number };
            cachedToken = data.access_token;
            tokenExpiresAt = Date.now() + data.expires_in * 1000;
            
            logger.info('USPS token refreshed successfully');
            return cachedToken;
        } catch (error: any) {
            logger.error('Failed to get USPS token', { error: error.message });
            return null;
        }
    });
}

function buildFormattedAddress(addr: any): string {
    let out = addr.streetAddressAbbreviation
        ? toTitleCase(addr.streetAddressAbbreviation)
        : addr.streetAddress
            ? toTitleCase(addr.streetAddress)
            : '';
    if (addr.city) out += `, ${toTitleCase(addr.city)}`;
    if (addr.state) out += `, ${addr.state}`;
    if (addr.ZIPCode) out += ` ${addr.ZIPCode}`;
    return out;
}

export async function correctAddress({
    streetAddress,
    city,
    state,
    zipCode,
}: AddressInput): Promise<AddressCorrectionResponse> {
    let errorMsg: string | undefined;
    const unformatted = [streetAddress, city, state, zipCode]
        .filter(Boolean)
        .join(', ');

    if (!streetAddress || !(city || zipCode)) {
        errorMsg = 'Missing required fields for USPS address correction.';
        return {
            location: cleanObject({
                streetAddress: streetAddress ? toTitleCase(streetAddress) : undefined,
                city: city ? toTitleCase(city) : undefined,
                state,
                zipCode,
                formattedAddress: '',
                unformattedAddress: unformatted,
            }) as AddressResult,
            status: false,
            error: errorMsg,
        };
    }

    const token = await getUSPSToken();
    if (!token) {
        errorMsg = 'Could not retrieve USPS access token.';
        return {
            location: cleanObject({
                streetAddress: toTitleCase(streetAddress),
                city: toTitleCase(city || ''),
                state,
                zipCode,
                formattedAddress: '',
                unformattedAddress: unformatted,
            }) as AddressResult,
            status: false,
            error: errorMsg,
        };
    }

    const params = new URLSearchParams();
    params.append('streetAddress', streetAddress);
    if (city) params.append('city', city);
    if (state) params.append('state', state);
    if (zipCode) params.append('ZIPCode', zipCode);

    let formattedAddress = '',
        statusFlag = false;
    const url = `${config.usps.addressUrl}/address?${params.toString()}`;

    try {
        // Create a unique key for this address request
        const addressKey = `usps-address:${streetAddress}:${city || ''}:${state || ''}:${zipCode || ''}`;
        
        const data = await uspsDeduplicator.execute(addressKey, async () => {
            const response = await uspsAxios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data as { address?: any };
        });

        if (data?.address) {
            formattedAddress = buildFormattedAddress(data.address);
            streetAddress = data.address.streetAddress
                ? toTitleCase(data.address.streetAddress)
                : toTitleCase(streetAddress);
            city = data.address.city
                ? toTitleCase(data.address.city)
                : city
                    ? toTitleCase(city)
                    : undefined;
            state = data.address.state;
            zipCode = data.address.ZIPCode;
            statusFlag = true;
        }
    } catch (err) {
        errorMsg = `Error fetching USPS Address API: ${err instanceof Error ? err.message : String(err)}`;
        logger.warn(streetAddress, city, state, zipCode, url, errorMsg);
    }

    const result: AddressCorrectionResponse = {
        location: cleanObject({
            streetAddress: streetAddress ? toTitleCase(streetAddress) : undefined,
            city: city ? toTitleCase(city) : undefined,
            state,
            zipCode,
            formattedAddress,
            unformattedAddress: unformatted,
        }) as AddressResult,
        status: statusFlag,
    };

    if (errorMsg) {
        result.error = errorMsg;
    }

    return result;
}

// Google Maps functions
function parseAddressComponents(components: any[]): any {
    let streetNumber = '',
        route = '',
        city = '',
        county = '',
        state = '',
        zipCode = '';

    for (const c of components) {
        if (c.types.includes('street_number')) streetNumber = c.long_name;
        if (c.types.includes('route')) route = c.long_name;

        if (c.types.includes('locality') || c.types.includes('postal_town'))
            city = c.long_name;

        if (!city && c.types.includes('administrative_area_level_3'))
            city = c.long_name;
        if (!city && c.types.includes('sublocality')) city = c.long_name;

        if (c.types.includes('administrative_area_level_2'))
            county = c.long_name.replace(/\s+County$/i, '');

        if (c.types.includes('administrative_area_level_1')) state = c.short_name;
        if (c.types.includes('postal_code')) zipCode = c.long_name;
    }

    return {
        city,
        county,
        state,
        zipCode,
        streetAddress: [streetNumber, route].filter(Boolean).join(' '),
        streetName: route || undefined,
        locality: city || county || undefined,
    };
}

function parseFirstGmapsResult(data: any) {
    if (!data || data.status !== 'OK' || !data.results?.length) return null;
    const best = data.results[0];
    if (!best) return null;
    
    const { lat, lng } = best.geometry.location;
    const formattedAddress = (best.formatted_address || '').replace(/,\s?USA$/, '');

    const {
        city,
        county,
        state,
        zipCode,
        streetAddress,
        streetName,
        locality,
    } = parseAddressComponents(best.address_components);

    return {
        geo: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] },
        formattedAddress,
        city,
        county,
        state,
        zipCode,
        streetAddress,
        streetName,
        locality,
    };
}

async function fetchGeoCoordinates({
    formattedAddress,
}: {
    formattedAddress: string;
}) {
    // Check cache first
    const cacheKey = generateGeocacheKey({ address: formattedAddress });
    const cached = geocodingCache.get(cacheKey);
    if (cached) {
        logger.debug('Geocoding cache hit', { address: formattedAddress });
        return cached;
    }

    try {
        // Use deduplication for Google Maps requests
        const geocodeKey = `geocode:${formattedAddress}`;
        
        const result = await googleMapsDeduplicator.execute(geocodeKey, async () => {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
                formattedAddress,
            )}&key=${config.googleMaps.apiKey}`;
            
            const response = await googleAxios.get(url);
            return parseFirstGmapsResult(response.data);
        });
        
        if (result) {
            // Cache the result
            geocodingCache.set(cacheKey, result);
        }
        
        return result;
    } catch (err) {
        logger.error('Error fetching geo coordinates:', err);
        return null;
    }
}

async function fetchAddressFromCoordinates(geo: Geo) {
    try {
        const [lng, lat] = geo.coordinates;
        
        // Check cache first
        const cacheKey = generateGeocacheKey({ lat, lng });
        const cached = geocodingCache.get(cacheKey);
        if (cached) {
            logger.debug('Reverse geocoding cache hit', { lat, lng });
            return cached;
        }
        
        // Use deduplication for reverse geocoding
        const reverseGeocodeKey = `reverse-geocode:${lat},${lng}`;
        
        const result = await googleMapsDeduplicator.execute(reverseGeocodeKey, async () => {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${config.googleMaps.apiKey}`;
            const response = await googleAxios.get(url);
            return parseFirstGmapsResult(response.data);
        });
        
        if (result) {
            // Cache the result
            geocodingCache.set(cacheKey, result);
        }
        
        return result;
    } catch (err) {
        logger.error('Error reverse geocoding:', err);
        return null;
    }
}

export async function ensureValidGeoCoordinates({
    lat,
    lng,
    geo,
    formattedAddress,
}: {
    lat?: number;
    lng?: number;
    geo?: Geo;
    formattedAddress?: string;
}): Promise<any> {
    let errorMsg: string | undefined;

    try {
        const currentGeo: Geo | null =
            geo ||
            (typeof lat === 'number' && typeof lng === 'number'
                ? { type: 'Point', coordinates: [lng, lat] }
                : null);

        if (currentGeo) {
            const [x, y] = currentGeo.coordinates;
            if (!(x === 0 && y === 0)) {
                if (!formattedAddress) {
                    const rev = await fetchAddressFromCoordinates(currentGeo);
                    if (!rev) {
                        errorMsg = 'Reverse geocoding failed: no address returned.';
                        return { status: true, location: { geo: currentGeo }, error: errorMsg };
                    }
                    return {
                        status: true,
                        location: {
                            geo: currentGeo,
                            formattedAddress: rev.formattedAddress,
                            city: rev.city,
                            state: rev.state,
                            zipCode: rev.zipCode,
                            streetAddress: rev.streetAddress,
                            streetName: rev.streetName,
                        },
                        ...(errorMsg && { error: errorMsg }),
                    };
                }
                return { status: true, location: { geo: currentGeo, formattedAddress }, ...(errorMsg && { error: errorMsg }) };
            }
        }

        if (formattedAddress) {
            const forwardData = await fetchGeoCoordinates({ formattedAddress });
            if (
                forwardData &&
                !(forwardData.geo.coordinates[0] === 0 && forwardData.geo.coordinates[1] === 0)
            ) {
                return {
                    status: true,
                    location: {
                        geo: forwardData.geo,
                        formattedAddress: forwardData.formattedAddress,
                        city: forwardData.city,
                        state: forwardData.state,
                        zipCode: forwardData.zipCode,
                        streetAddress: forwardData.streetAddress,
                        streetName: forwardData.streetName,
                    },
                    ...(errorMsg && { error: errorMsg }),
                };
            }
            errorMsg =
                'Failed to fetch valid geo coordinates with the provided formatted address.';
        }

        const fallback: Geo = { type: 'Point', coordinates: [0, 0] };
        return { status: false, location: { geo: fallback, formattedAddress }, error: errorMsg };
    } catch (err) {
        errorMsg = `Error in ensureValidGeoCoordinates: ${err instanceof Error ? err.message : String(err)}`;
        logger.error(errorMsg);
        return {
            status: false,
            location: { geo: { type: 'Point', coordinates: [0, 0] }, formattedAddress },
            error: errorMsg,
        };
    }
}

// Main correction function
export async function correctLocation(location: LocationReturn): Promise<any> {
    // 1) USPS address correction
    const uspsInput: AddressInput = {
        ...(location.streetAddress && { streetAddress: location.streetAddress }),
        ...(location.city && { city: location.city }),
        ...(location.state && { state: location.state }),
        ...(location.zipCode && { zipCode: location.zipCode }),
    };
    const uspsResult = await correctAddress(uspsInput);

    let updatedLocation: any = { ...location, ...uspsResult.location };

    if (typeof updatedLocation.county === 'string') {
        updatedLocation.county = updatedLocation.county
            .replace(/\bCounty\b/gi, '')
            .trim();
    }

    // ensure we _always_ have something to forward‑geocode with
    if (!updatedLocation.formattedAddress) {
        updatedLocation.formattedAddress = [
            updatedLocation.streetAddress,
            updatedLocation.city,
            updatedLocation.state,
            updatedLocation.zipCode,
        ]
            .filter(Boolean)
            .join(', ');
    }

    // 2) Google geo correction
    const geoInput = {
        geo: updatedLocation.geo,
        formattedAddress: updatedLocation.formattedAddress,
    };
    const geoResult = await ensureValidGeoCoordinates(geoInput);

    updatedLocation.geo = geoResult.location.geo;

    updatedLocation.formattedAddress =
        geoResult.location.formattedAddress || updatedLocation.formattedAddress;

    if (!updatedLocation.state && geoResult.location.state) {
        updatedLocation.state = geoResult.location.state;
    }
    if (!updatedLocation.zipCode && geoResult.location.zipCode) {
        updatedLocation.zipCode = geoResult.location.zipCode;
    }
    if (geoResult.location.streetAddress) {
        updatedLocation.streetAddress = geoResult.location.streetAddress;
    }
    delete updatedLocation.locality;
    const error = uspsResult.error || geoResult.error;
    const status = uspsResult.status && geoResult.status;

    return { ...updatedLocation, status, error };
}

// Initialize Express app
const app = express();

// Middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Health check (before security middleware)
app.get('/health', (_req: Request, res: Response) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config.nodeEnv,
        cache: geocodingCache.getStats(),
        deduplication: {
            usps: uspsDeduplicator.getStats(),
            googleMaps: googleMapsDeduplicator.getStats()
        }
    };
    
    res.status(200).json(health);
});

// Security middleware (if enabled)
if (config.nodeEnv === 'production' || process.env['ENABLE_SECURITY'] === 'true') {
    app.use(...securityMiddleware());
}

// Local only middleware
app.use(localOnlyMiddleware);

// Cache stats endpoint
app.get('/cache/stats', (_req: Request, res: Response) => {
    res.json({
        geocoding: geocodingCache.getStats(),
        cleanedExpired: geocodingCache.cleanExpired()
    });
});

// Batch processing endpoint
app.post(
    '/validate-locations',
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { locations } = req.body as { locations: LocationReturn[] };
        
        if (!Array.isArray(locations)) {
            res.status(400).json({
                error: 'Request body must contain a locations array',
                status: false
            });
            return;
        }
        
        if (locations.length > 100) {
            res.status(400).json({
                error: 'Maximum 100 locations per batch',
                status: false
            });
            return;
        }
        
        const results = await Promise.all(
            locations.map(async (location, index) => {
                try {
                    const result = await correctLocation(location);
                    return { index, ...result };
                } catch (error: any) {
                    return {
                        index,
                        status: false,
                        error: error.message
                    };
                }
            })
        );
        
        res.json({
            count: results.length,
            results
        });
    })
);

// Main validation endpoint
app.post(
    '/validate-location',
    validateLocationRequest,
    asyncHandler(async (req: Request<{}, {}, ValidateLocationRequest>, res: Response) => {
        const locationInput = req.body as unknown as LocationReturn;
        const corrected = await correctLocation(locationInput);
        
        // Add cache headers
        res.set({
            'Cache-Control': 'public, max-age=86400', // 24 hours
            'X-Cache-Status': 'miss' // Could be enhanced to show hit/miss
        });
        
        logger.info('Location validated', { 
            input: locationInput.streetAddress,
            output: corrected.formattedAddress,
            status: corrected.status
        });
        
        res.json(corrected);
    })
);

// Error handler
app.use(errorHandler);

// Graceful shutdown
let server: any;

async function shutdown() {
    logger.info('Shutting down gracefully...');
    
    if (server) {
        await new Promise((resolve) => {
            server.close(resolve);
        });
    }
    
    // Clean up cache
    geocodingCache.clear();
    
    // Clean up deduplicators
    uspsDeduplicator.clear();
    googleMapsDeduplicator.clear();
    
    // Clean up HTTP agents
    httpAgent.destroy();
    httpsAgent.destroy();
    
    logger.info('Shutdown complete');
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
(async () => {
    try {
        const port = config.port;
        
        server = app.listen(port, () => {
            logger.info(`Server running on port ${port}`, {
                environment: config.nodeEnv,
                cacheSize: config.cache.geocodingCacheSize,
                cacheTTL: config.cache.geocodingCacheTTL
            });
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
})();

export { app };