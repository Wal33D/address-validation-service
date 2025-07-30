"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
exports.correctAddress = correctAddress;
exports.ensureValidGeoCoordinates = ensureValidGeoCoordinates;
exports.correctLocation = correctLocation;
const express_1 = __importDefault(require("express"));
const compression_1 = __importDefault(require("compression"));
const axios_1 = __importDefault(require("axios"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = __importDefault(require("./utils/logger"));
const LRUCache_1 = require("./utils/LRUCache");
const errorHandler_1 = require("./middleware/errorHandler");
const localOnlyMiddleware_1 = require("./middleware/localOnlyMiddleware");
const security_1 = require("./middleware/security");
const validation_1 = require("./middleware/validation");
const config_1 = require("./config");
dotenv_1.default.config();
const geocodingCache = new LRUCache_1.LRUCache(config_1.config.cache.geocodingCacheSize, config_1.config.cache.geocodingCacheTTL);
let cachedToken = null;
let tokenExpiresAt = null;
const createAxiosInstance = (baseURL, timeout = 10000) => {
    const instance = axios_1.default.create({
        ...(baseURL && { baseURL }),
        timeout,
        headers: {
            'User-Agent': 'CandyComp-Location-Service/1.0'
        }
    });
    instance.interceptors.response.use(response => response, async (error) => {
        const originalRequest = error.config;
        if (!originalRequest._retry && (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')) {
            originalRequest._retry = true;
            logger_1.default.warn(`Retrying request to ${originalRequest.url}`);
            return instance(originalRequest);
        }
        return Promise.reject(error);
    });
    return instance;
};
const uspsAxios = createAxiosInstance(undefined, 30000);
const googleAxios = createAxiosInstance(undefined, 10000);
function toTitleCase(s) {
    return s
        .toLowerCase()
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}
function cleanObject(obj) {
    return Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined && v !== ''));
}
async function getUSPSToken() {
    if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 60000) {
        return cachedToken;
    }
    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config_1.config.usps.consumerKey,
        client_secret: config_1.config.usps.consumerSecret,
        scope: 'addresses',
    });
    try {
        const response = await uspsAxios.post(config_1.config.usps.tokenUrl, body.toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        const data = response.data;
        cachedToken = data.access_token;
        tokenExpiresAt = Date.now() + data.expires_in * 1000;
        logger_1.default.info('USPS token refreshed successfully');
        return cachedToken;
    }
    catch (error) {
        logger_1.default.error('Failed to get USPS token', { error: error.message });
        return null;
    }
}
function buildFormattedAddress(addr) {
    let out = addr.streetAddressAbbreviation
        ? toTitleCase(addr.streetAddressAbbreviation)
        : addr.streetAddress
            ? toTitleCase(addr.streetAddress)
            : '';
    if (addr.city)
        out += `, ${toTitleCase(addr.city)}`;
    if (addr.state)
        out += `, ${addr.state}`;
    if (addr.ZIPCode)
        out += ` ${addr.ZIPCode}`;
    return out;
}
async function correctAddress({ streetAddress, city, state, zipCode, }) {
    let errorMsg;
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
            }),
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
            }),
            status: false,
            error: errorMsg,
        };
    }
    const params = new URLSearchParams();
    params.append('streetAddress', streetAddress);
    if (city)
        params.append('city', city);
    if (state)
        params.append('state', state);
    if (zipCode)
        params.append('ZIPCode', zipCode);
    let formattedAddress = '', statusFlag = false;
    const url = `${config_1.config.usps.addressUrl}/address?${params.toString()}`;
    try {
        const response = await uspsAxios.get(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = response.data;
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
    }
    catch (err) {
        errorMsg = `Error fetching USPS Address API: ${err instanceof Error ? err.message : String(err)}`;
        logger_1.default.warn(streetAddress, city, state, zipCode, url, errorMsg);
    }
    const result = {
        location: cleanObject({
            streetAddress: streetAddress ? toTitleCase(streetAddress) : undefined,
            city: city ? toTitleCase(city) : undefined,
            state,
            zipCode,
            formattedAddress,
            unformattedAddress: unformatted,
        }),
        status: statusFlag,
    };
    if (errorMsg) {
        result.error = errorMsg;
    }
    return result;
}
function parseAddressComponents(components) {
    let streetNumber = '', route = '', city = '', county = '', state = '', zipCode = '';
    for (const c of components) {
        if (c.types.includes('street_number'))
            streetNumber = c.long_name;
        if (c.types.includes('route'))
            route = c.long_name;
        if (c.types.includes('locality') || c.types.includes('postal_town'))
            city = c.long_name;
        if (!city && c.types.includes('administrative_area_level_3'))
            city = c.long_name;
        if (!city && c.types.includes('sublocality'))
            city = c.long_name;
        if (c.types.includes('administrative_area_level_2'))
            county = c.long_name.replace(/\s+County$/i, '');
        if (c.types.includes('administrative_area_level_1'))
            state = c.short_name;
        if (c.types.includes('postal_code'))
            zipCode = c.long_name;
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
function parseFirstGmapsResult(data) {
    if (!data || data.status !== 'OK' || !data.results?.length)
        return null;
    const best = data.results[0];
    if (!best)
        return null;
    const { lat, lng } = best.geometry.location;
    const formattedAddress = (best.formatted_address || '').replace(/,\s?USA$/, '');
    const { city, county, state, zipCode, streetAddress, streetName, locality, } = parseAddressComponents(best.address_components);
    return {
        geo: { type: 'Point', coordinates: [lng, lat] },
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
async function fetchGeoCoordinates({ formattedAddress, }) {
    const cacheKey = (0, LRUCache_1.generateGeocacheKey)({ address: formattedAddress });
    const cached = geocodingCache.get(cacheKey);
    if (cached) {
        logger_1.default.debug('Geocoding cache hit', { address: formattedAddress });
        return cached;
    }
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(formattedAddress)}&key=${config_1.config.googleMaps.apiKey}`;
        const response = await googleAxios.get(url);
        const result = parseFirstGmapsResult(response.data);
        if (result) {
            geocodingCache.set(cacheKey, result);
        }
        return result;
    }
    catch (err) {
        logger_1.default.error('Error fetching geo coordinates:', err);
        return null;
    }
}
async function fetchAddressFromCoordinates(geo) {
    try {
        const [lng, lat] = geo.coordinates;
        const cacheKey = (0, LRUCache_1.generateGeocacheKey)({ lat, lng });
        const cached = geocodingCache.get(cacheKey);
        if (cached) {
            logger_1.default.debug('Reverse geocoding cache hit', { lat, lng });
            return cached;
        }
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${config_1.config.googleMaps.apiKey}`;
        const response = await googleAxios.get(url);
        const result = parseFirstGmapsResult(response.data);
        if (result) {
            geocodingCache.set(cacheKey, result);
        }
        return result;
    }
    catch (err) {
        logger_1.default.error('Error reverse geocoding:', err);
        return null;
    }
}
async function ensureValidGeoCoordinates({ lat, lng, geo, formattedAddress, }) {
    let errorMsg;
    try {
        const currentGeo = geo ||
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
            if (forwardData &&
                !(forwardData.geo.coordinates[0] === 0 && forwardData.geo.coordinates[1] === 0)) {
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
        const fallback = { type: 'Point', coordinates: [0, 0] };
        return { status: false, location: { geo: fallback, formattedAddress }, error: errorMsg };
    }
    catch (err) {
        errorMsg = `Error in ensureValidGeoCoordinates: ${err instanceof Error ? err.message : String(err)}`;
        logger_1.default.error(errorMsg);
        return {
            status: false,
            location: { geo: { type: 'Point', coordinates: [0, 0] }, formattedAddress },
            error: errorMsg,
        };
    }
}
async function correctLocation(location) {
    const uspsInput = {
        ...(location.streetAddress && { streetAddress: location.streetAddress }),
        ...(location.city && { city: location.city }),
        ...(location.state && { state: location.state }),
        ...(location.zipCode && { zipCode: location.zipCode }),
    };
    const uspsResult = await correctAddress(uspsInput);
    let updatedLocation = { ...location, ...uspsResult.location };
    if (typeof updatedLocation.county === 'string') {
        updatedLocation.county = updatedLocation.county
            .replace(/\bCounty\b/gi, '')
            .trim();
    }
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
const app = (0, express_1.default)();
exports.app = app;
app.use((0, compression_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.get('/health', (_req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: config_1.config.nodeEnv,
        cache: geocodingCache.getStats()
    };
    res.status(200).json(health);
});
if (config_1.config.nodeEnv === 'production' || process.env['ENABLE_SECURITY'] === 'true') {
    app.use(...(0, security_1.securityMiddleware)());
}
app.use(localOnlyMiddleware_1.localOnlyMiddleware);
app.get('/cache/stats', (_req, res) => {
    res.json({
        geocoding: geocodingCache.getStats(),
        cleanedExpired: geocodingCache.cleanExpired()
    });
});
app.post('/validate-locations', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { locations } = req.body;
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
    const results = await Promise.all(locations.map(async (location, index) => {
        try {
            const result = await correctLocation(location);
            return { index, ...result };
        }
        catch (error) {
            return {
                index,
                status: false,
                error: error.message
            };
        }
    }));
    res.json({
        count: results.length,
        results
    });
}));
app.post('/validate-location', validation_1.validateLocationRequest, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const locationInput = req.body;
    const corrected = await correctLocation(locationInput);
    res.set({
        'Cache-Control': 'public, max-age=86400',
        'X-Cache-Status': 'miss'
    });
    logger_1.default.info('Location validated', {
        input: locationInput.streetAddress,
        output: corrected.formattedAddress,
        status: corrected.status
    });
    res.json(corrected);
}));
app.use(errorHandler_1.errorHandler);
let server;
async function shutdown() {
    logger_1.default.info('Shutting down gracefully...');
    if (server) {
        await new Promise((resolve) => {
            server.close(resolve);
        });
    }
    geocodingCache.clear();
    logger_1.default.info('Shutdown complete');
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
(async () => {
    try {
        const port = config_1.config.port;
        server = app.listen(port, () => {
            logger_1.default.info(`Server running on port ${port}`, {
                environment: config_1.config.nodeEnv,
                cacheSize: config_1.config.cache.geocodingCacheSize,
                cacheTTL: config_1.config.cache.geocodingCacheTTL
            });
        });
    }
    catch (error) {
        logger_1.default.error('Failed to start server:', error);
        process.exit(1);
    }
})();
//# sourceMappingURL=server.js.map