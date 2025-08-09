import https from 'https';
import http from 'http';
import dotenv from 'dotenv';
import logger from './utils/logger';
import compression from 'compression';
import { config } from './config';
import { securityMiddleware } from './middleware/security';
import {
  LocationReturn,
  Geo,
  USPSTokenResponse,
  USPSAddress,
  USPSAddressResponse,
  GoogleAddressComponent,
  GoogleMapsResponse,
  ParsedAddressComponents,
  GeocodingResult,
  CountyResult,
  GeoValidationResult,
  LocationCorrectionResult,
  AddressInput,
  AddressResult,
  AddressCorrectionResponse,
} from './types';
import { localOnlyMiddleware } from './middleware/localOnlyMiddleware';
import { addressPreprocessor } from './utils/AddressPreprocessor';
import axios, { AxiosInstance } from 'axios';
import { validateLocationRequest } from './middleware/validation';
import { errorHandler, asyncHandler } from './middleware/errorHandler';
import express, { Request, Response } from 'express';
import { LRUCache, generateGeocacheKey } from './utils/LRUCache';
import { uspsDeduplicator, googleMapsDeduplicator } from './utils/RequestDeduplicator';
import { uspsCircuitBreaker, googleMapsCircuitBreaker } from './utils/CircuitBreaker';
import { normalizeAddress } from './utils/normalizeAddress';

// Suppress dotenv logging by intercepting console.log temporarily
const originalLog = console.log;
console.log = () => {};
dotenv.config();
console.log = originalLog;

// Initialize caches
const geocodingCache = new LRUCache<string, GeocodingResult>(
  config.cache.geocodingCacheSize,
  config.cache.geocodingCacheTTL
);
const countyCache = new LRUCache<string, CountyResult>(
  config.cache.geocodingCacheSize,
  config.cache.geocodingCacheTTL
);

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
  scheduling: 'lifo', // Last-in-first-out scheduling
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: 60000,
  scheduling: 'lifo',
  rejectUnauthorized: true,
});

// Create axios instances with retry logic and connection pooling
const createAxiosInstance = (baseURL?: string, timeout: number = 10000): AxiosInstance => {
  const instance = axios.create({
    ...(baseURL && { baseURL }),
    timeout,
    headers: {
      'User-Agent': 'CandyComp-Location-Service/1.0',
    },
    httpAgent,
    httpsAgent,
    // Additional performance optimizations
    maxRedirects: 5,
    decompress: true,
    validateStatus: status => status < 500, // Don't throw on 4xx errors
  });

  // Add retry interceptor
  instance.interceptors.response.use(
    response => response,
    async error => {
      const originalRequest = error.config;

      if (
        !originalRequest._retry &&
        (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT')
      ) {
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

  // Use deduplication and circuit breaker for token requests
  return uspsDeduplicator.execute('usps-token', async () => {
    return uspsCircuitBreaker.execute(async () => {
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.usps.consumerKey,
        client_secret: config.usps.consumerSecret,
        scope: 'addresses',
      });

      try {
        const response = await uspsAxios.post(config.usps.tokenUrl, body.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });

        const data = response.data as USPSTokenResponse;
        cachedToken = data.access_token;
        tokenExpiresAt = Date.now() + data.expires_in * 1000;

        logger.info('USPS token refreshed successfully');
        return cachedToken;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to get USPS token', { error: errorMessage });
        throw new Error(errorMessage); // Let circuit breaker handle the failure
      }
    });
  }) as Promise<string | null>;
}

function buildFormattedAddress(addr: USPSAddress): string {
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
  const unformatted = [streetAddress, city, state, zipCode].filter(Boolean).join(', ');

  // Preprocess the address
  const preprocessed = addressPreprocessor.preprocessAddress({
    ...(streetAddress && { streetAddress }),
    ...(city && { city }),
    ...(state && { state }),
    ...(zipCode && { zipCode }),
  });

  // Update variables with preprocessed values
  streetAddress = preprocessed.streetAddress;
  city = preprocessed.city;
  state = preprocessed.state;
  zipCode = preprocessed.zipCode;

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

    const data = (await uspsDeduplicator.execute(
      addressKey,
      async (): Promise<USPSAddressResponse> => {
        return uspsCircuitBreaker.execute(async () => {
          const response = await uspsAxios.get(url, {
            headers: { Authorization: `Bearer ${token}` },
          });
          return response.data as USPSAddressResponse;
        });
      }
    )) as USPSAddressResponse;

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
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    // Improved error logging
    logger.warn('USPS API error', {
      input: {
        streetAddress,
        city,
        state,
        zipCode,
      },
      url,
      error: error.message,
      status:
        'response' in error &&
        error.response &&
        typeof error.response === 'object' &&
        'status' in error.response
          ? (error.response as { status: number }).status
          : undefined,
      timestamp: new Date().toISOString(),
    });

    // Implement ZIP-only fallback for 400 errors when we have city and ZIP
    if (addressPreprocessor.shouldRetryWithoutCity(error, !!city, !!zipCode)) {
      logger.info('Retrying USPS request without city parameter');

      try {
        const zipOnlyParams = new URLSearchParams();
        zipOnlyParams.append('streetAddress', params.get('streetAddress') || '');
        if (state) zipOnlyParams.append('state', state);
        zipOnlyParams.append('ZIPCode', zipCode!);

        const zipOnlyUrl = `${config.usps.addressUrl}/address?${zipOnlyParams.toString()}`;
        const zipOnlyKey = `usps-address:${streetAddress}::${state || ''}:${zipCode}`;

        const retryData = (await uspsDeduplicator.execute(
          zipOnlyKey,
          async (): Promise<USPSAddressResponse> => {
            return uspsCircuitBreaker.execute(async () => {
              const response = await uspsAxios.get(zipOnlyUrl, {
                headers: { Authorization: `Bearer ${token}` },
              });
              return response.data as USPSAddressResponse;
            });
          }
        )) as USPSAddressResponse;

        if (retryData?.address) {
          formattedAddress = buildFormattedAddress(retryData.address);
          streetAddress = retryData.address.streetAddress
            ? toTitleCase(retryData.address.streetAddress)
            : toTitleCase(streetAddress);
          city = retryData.address.city
            ? toTitleCase(retryData.address.city)
            : city
              ? toTitleCase(city)
              : undefined;
          state = retryData.address.state;
          zipCode = retryData.address.ZIPCode;
          statusFlag = true;
          errorMsg = undefined; // Clear error on successful retry
        }
      } catch (retryErr: unknown) {
        const retryError = retryErr instanceof Error ? retryErr : new Error(String(retryErr));
        errorMsg = `Error fetching USPS Address API (with retry): ${retryError.message}`;
        logger.error('USPS ZIP-only retry failed', {
          error: retryError.message,
          status:
            'response' in retryError &&
            retryError.response &&
            typeof retryError.response === 'object' &&
            'status' in retryError.response
              ? (retryError.response as { status: number }).status
              : undefined,
        });
      }
    } else {
      errorMsg = `Error fetching USPS Address API: ${error.message}`;
    }
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
function parseAddressComponents(components: GoogleAddressComponent[]): ParsedAddressComponents {
  let streetNumber = '',
    route = '',
    city = '',
    county = '',
    state = '',
    zipCode = '';

  for (const c of components) {
    if (c.types.includes('street_number')) streetNumber = c.long_name;
    if (c.types.includes('route')) route = c.long_name;

    if (c.types.includes('locality') || c.types.includes('postal_town')) city = c.long_name;

    if (!city && c.types.includes('administrative_area_level_3')) city = c.long_name;
    if (!city && c.types.includes('sublocality')) city = c.long_name;

    if (c.types.includes('administrative_area_level_2')) {
      county = c.long_name.replace(/\s+County$/i, '');
      logger.debug('Found administrative_area_level_2', {
        original: c.long_name,
        cleaned: county,
      });
    }

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

function parseFirstGmapsResult(data: GoogleMapsResponse): GeocodingResult | null {
  if (!data || data.status !== 'OK' || !data.results?.length) return null;
  const best = data.results[0];
  if (!best) return null;

  const { lat, lng } = best.geometry.location;
  const formattedAddress = (best.formatted_address || '').replace(/,\s?USA$/, '');

  const { city, county, state, zipCode, streetAddress, streetName, locality } =
    parseAddressComponents(best.address_components);

  // Debug logging for county
  if (county) {
    logger.info('County found in Google Maps response', { county });
  } else {
    logger.info('No county found in Google Maps response');
  }

  const result = {
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

  logger.info('parseFirstGmapsResult returning', { county, city, state });
  return result;
}

async function fetchGeoCoordinates({ formattedAddress }: { formattedAddress: string }) {
  // First attempt: Standard geocoding
  const standardResult = await fetchGeoCoordinatesStandard(formattedAddress);

  // If we got a result but no county, try reverse geocoding with the coordinates
  if (standardResult && !standardResult.county && standardResult.geo) {
    const reverseResult = await fetchCountyByCoordinates(standardResult.geo);
    if (reverseResult?.county) {
      standardResult.county = reverseResult.county;
      logger.info('County enriched via reverse geocoding', { county: reverseResult.county });
    }
  }

  return standardResult;
}

async function fetchGeoCoordinatesStandard(
  formattedAddress: string
): Promise<GeocodingResult | null> {
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

    const result = (await googleMapsDeduplicator.execute(
      geocodeKey,
      async (): Promise<GeocodingResult | null> => {
        return googleMapsCircuitBreaker.execute(async () => {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
            formattedAddress
          )}&key=${config.googleMaps.apiKey}`;

          const response = await googleAxios.get(url);
          return parseFirstGmapsResult(response.data);
        });
      }
    )) as GeocodingResult | null;

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

// Fetch county specifically using reverse geocoding with result_type filter
async function fetchCountyByCoordinates(geo: Geo): Promise<CountyResult | null> {
  try {
    const [lng, lat] = geo.coordinates;
    const countyKey = `county:${lat},${lng}`;

    // Check cache first
    const cached = countyCache.get(countyKey);
    if (cached) {
      return cached;
    }

    const result = (await googleMapsDeduplicator.execute(
      countyKey,
      async (): Promise<CountyResult | null> => {
        return googleMapsCircuitBreaker.execute(async () => {
          // Use result_type filter to specifically get county
          const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&result_type=administrative_area_level_2&key=${config.googleMaps.apiKey}`;
          const response = await googleAxios.get(url);

          const responseData = response.data as GoogleMapsResponse;
          if (responseData.status === 'OK' && responseData.results?.length > 0) {
            const countyResult = responseData.results[0];
            const countyComponent = countyResult.address_components?.find(
              (c: GoogleAddressComponent) => c.types.includes('administrative_area_level_2')
            );

            if (countyComponent) {
              const county = countyComponent.long_name.replace(/\s+County$/i, '');
              logger.info('County fetched via reverse geocoding with filter', { county });
              const result = { county };
              countyCache.set(countyKey, result);
              return result;
            }
          }
          return null;
        });
      }
    )) as CountyResult | null;

    return result;
  } catch (err) {
    logger.error('Error fetching county by coordinates:', err);
    return null;
  }
}

async function fetchAddressFromCoordinates(geo: Geo): Promise<GeocodingResult | null> {
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

    const result = (await googleMapsDeduplicator.execute(
      reverseGeocodeKey,
      async (): Promise<GeocodingResult | null> => {
        return googleMapsCircuitBreaker.execute(async () => {
          const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${config.googleMaps.apiKey}`;
          const response = await googleAxios.get(url);
          return parseFirstGmapsResult(response.data);
        });
      }
    )) as GeocodingResult | null;

    if (result) {
      // Cache the result
      geocodingCache.set(cacheKey, result);
    }

    return result;
  } catch (err) {
    logger.error('Error reverse geocoding:', {
      error: err instanceof Error ? err.message : String(err),
      coordinates: geo,
    });
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
}): Promise<GeoValidationResult> {
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
              county: rev.county,
              state: rev.state,
              zipCode: rev.zipCode,
              streetAddress: rev.streetAddress,
              streetName: rev.streetName,
            },
            ...(errorMsg && { error: errorMsg }),
          };
        }
        return {
          status: true,
          location: { geo: currentGeo, formattedAddress },
          ...(errorMsg && { error: errorMsg }),
        };
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
            county: forwardData.county,
            state: forwardData.state,
            zipCode: forwardData.zipCode,
            streetAddress: forwardData.streetAddress,
            streetName: forwardData.streetName,
          },
          ...(errorMsg && { error: errorMsg }),
        };
      }
      errorMsg = 'Failed to fetch valid geo coordinates with the provided formatted address.';
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
export async function correctLocation(location: LocationReturn): Promise<LocationCorrectionResult> {
  // Check if we have coordinates but no city/zip - skip USPS in this case
  const hasCoordinates =
    location.geo &&
    location.geo.coordinates &&
    location.geo.coordinates[0] !== 0 &&
    location.geo.coordinates[1] !== 0;
  const hasCityOrZip = location.city || location.zipCode;

  // For coordinates-only cases, try reverse geocoding first to get full address
  if (hasCoordinates && !hasCityOrZip) {
    logger.info('Attempting reverse geocoding for coordinates-only address');
    const reverseResult = await fetchAddressFromCoordinates(location.geo!);
    if (reverseResult) {
      // Enrich location with reverse geocoded data
      location = {
        ...location,
        city: reverseResult.city || location.city,
        zipCode: reverseResult.zipCode || location.zipCode,
        county: reverseResult.county || location.county,
        formattedAddress: reverseResult.formattedAddress || location.formattedAddress,
      };
      logger.info('Location enriched from reverse geocoding', {
        city: location.city,
        zipCode: location.zipCode,
        county: location.county,
      });
    }
  }

  let uspsResult: AddressCorrectionResponse;
  let updatedLocation: Partial<LocationReturn> & { status?: boolean } = { ...location };

  // 1) USPS address correction (skip if we have coordinates but no city/zip)
  if (!hasCoordinates || hasCityOrZip) {
    const uspsInput: AddressInput = {
      ...(location.streetAddress && { streetAddress: location.streetAddress }),
      ...(location.city && { city: location.city }),
      ...(location.state && { state: location.state }),
      ...(location.zipCode && { zipCode: location.zipCode }),
    };
    uspsResult = await correctAddress(uspsInput);
    updatedLocation = { ...location, ...uspsResult.location };
  } else {
    // Skip USPS when we have coordinates but no city/zip
    uspsResult = {
      location: {},
      status: true,
    };
    logger.info('Skipping USPS correction - have coordinates without city/zip');
  }

  if (typeof updatedLocation.county === 'string') {
    updatedLocation.county = updatedLocation.county.replace(/\bCounty\b/gi, '').trim();
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

  // Use Google's results to fill in missing data
  if (!updatedLocation.city && geoResult.location.city) {
    updatedLocation.city = geoResult.location.city;
    logger.info('City added from Google geocoding', { city: updatedLocation.city });
  }
  if (!updatedLocation.state && geoResult.location.state) {
    updatedLocation.state = geoResult.location.state;
  }
  if (!updatedLocation.zipCode && geoResult.location.zipCode) {
    updatedLocation.zipCode = geoResult.location.zipCode;
    logger.info('ZipCode added from Google geocoding', { zipCode: updatedLocation.zipCode });
  }
  if (geoResult.location.streetAddress) {
    updatedLocation.streetAddress = geoResult.location.streetAddress;
  }
  if (geoResult.location.county) {
    updatedLocation.county = geoResult.location.county;
    logger.info('County added to updatedLocation', { county: updatedLocation.county });
  } else {
    logger.info('No county in geoResult.location', { geoResult: geoResult.location });
    // Try to fetch county via reverse geocoding if we have coordinates
    if (updatedLocation.geo && updatedLocation.geo.coordinates[0] !== 0) {
      const countyResult = await fetchCountyByCoordinates(updatedLocation.geo);
      if (countyResult?.county) {
        updatedLocation.county = countyResult.county;
        logger.info('County enriched for regular address', { county: countyResult.county });
      }
    }
  }
  delete updatedLocation.locality;

  // More lenient status logic - if Google geocoding succeeds, consider it a success
  // especially if it enriches the data with missing city/zip
  const error = uspsResult.error || geoResult.error;

  // Success if:
  // 1. Google geocoding succeeded AND
  // 2. Either USPS succeeded OR we now have complete address data OR we had coords without city/zip
  const hasCompleteAddress =
    updatedLocation.streetAddress &&
    (updatedLocation.city || updatedLocation.zipCode) &&
    updatedLocation.state;

  const status =
    geoResult.status &&
    (uspsResult.status || hasCompleteAddress || (hasCoordinates && !hasCityOrZip));

  // Debug: Check if updatedLocation contains a status field
  if ('status' in updatedLocation) {
    logger.warn('updatedLocation contains status field:', updatedLocation.status);
  }

  // Normalize the formatted address for consistent comparison
  const normalizedAddress = updatedLocation.formattedAddress
    ? normalizeAddress(updatedLocation.formattedAddress)
    : undefined;

  // Create result object with explicit status and error fields
  // IMPORTANT: Don't spread updatedLocation directly as it may contain a 'status' field
  const result: LocationCorrectionResult = {
    streetAddress: updatedLocation.streetAddress,
    city: updatedLocation.city,
    state: updatedLocation.state,
    zipCode: updatedLocation.zipCode,
    county: updatedLocation.county,
    geo: updatedLocation.geo,
    formattedAddress: updatedLocation.formattedAddress,
    normalizedAddress, // Add the normalized address
    unformattedAddress: updatedLocation.unformattedAddress,
    // Explicitly set status and error
    status: Boolean(status),
    ...(error && { error: error }),
  };

  // Check for status field issues
  logger.debug('Status check:', {
    calculatedStatus: status,
    resultStatus: result.status,
    hasUpdatedLocationStatus: 'status' in updatedLocation,
    updatedLocationStatus: updatedLocation.status,
  });

  // Ensure status is always a boolean
  result.status = Boolean(status);

  return result;
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
    cache: {
      geocoding: geocodingCache.getStats(),
      county: countyCache.getStats(),
    },
    deduplication: {
      usps: uspsDeduplicator.getStats(),
      googleMaps: googleMapsDeduplicator.getStats(),
    },
    circuitBreakers: {
      usps: uspsCircuitBreaker.getStats(),
      googleMaps: googleMapsCircuitBreaker.getStats(),
    },
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
    county: countyCache.getStats(),
    cleanedExpired: {
      geocoding: geocodingCache.cleanExpired(),
      county: countyCache.cleanExpired(),
    },
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
        status: false,
      });
      return;
    }

    if (locations.length > 100) {
      res.status(400).json({
        error: 'Maximum 100 locations per batch',
        status: false,
      });
      return;
    }

    const results = await Promise.all(
      locations.map(async (location, index) => {
        try {
          const result = await correctLocation(location);
          return { index, ...result };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            index,
            status: false,
            error: errorMessage,
          };
        }
      })
    );

    res.json({
      count: results.length,
      results,
    });
  })
);

// Main validation endpoint
app.post(
  '/validate-location',
  validateLocationRequest,
  asyncHandler(async (req: Request, res: Response) => {
    const locationInput = req.body as unknown as LocationReturn;
    const corrected = await correctLocation(locationInput);

    // Add cache headers
    res.set({
      'Cache-Control': 'public, max-age=86400', // 24 hours
      'X-Cache-Status': 'miss', // Could be enhanced to show hit/miss
    });

    logger.info('Location validated', {
      input: locationInput.streetAddress,
      output: corrected.formattedAddress,
      status: corrected.status,
    });

    res.json(corrected);
  })
);

// Error handler
app.use(errorHandler);

// Graceful shutdown
let server: http.Server | undefined;

async function shutdown() {
  logger.info('Shutting down gracefully...');

  if (server) {
    await new Promise(resolve => {
      server!.close(resolve);
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
        cacheTTL: config.cache.geocodingCacheTTL,
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
})();

export { app };
