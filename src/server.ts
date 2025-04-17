import dotenv from 'dotenv';
import express, { Request, Response } from 'express';

import { LocationReturn } from './types';

dotenv.config();

// =====================================
// Environment Variables
// =====================================

const {
	USPS_TOKEN_URL,
	USPS_ADDRESS_URL,
	USPS_CONSUMER_KEY,
	USPS_CONSUMER_SECRET,
	GMAPS_API_KEY,
	PORT = 3715,
} = process.env;

if (!USPS_TOKEN_URL || !USPS_ADDRESS_URL || !USPS_CONSUMER_KEY || !USPS_CONSUMER_SECRET || !GMAPS_API_KEY) {
	throw new Error('Missing required environment variables for USPS or Google Maps.');
}

// =====================================
// Types and Interfaces
// =====================================

export interface Geo {
	type: 'Point';
	coordinates: [number, number]; // [lng, lat]
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

/**
 * Now includes optional `streetAddress` and `streetName` so the final
 * geocoded location can return them if found.
 */
export interface GeoCorrectionResponse {
	status: boolean;
	location: {
		geo: Geo;
		formattedAddress?: string;
		city?: string;
		locality?: string;
		state?: string;
		zipCode?: string;
		streetAddress?: string;
		streetName?: string;
	};
	error?: string;
}

// =====================================
// USPS: Token + Address Correction
// =====================================

let cachedToken: string | null = null;
let tokenExpiresAt: number | null = null;

function toTitleCase(s: string) {
	return s
		.toLowerCase()
		.split(' ')
		.map(w => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

function cleanObject<T extends object>(obj: T): Partial<T> {
	// Filter out undefined and empty string
	return Object.fromEntries(
		Object.entries(obj).filter(([, v]) => v !== undefined && v !== '')
	) as Partial<T>;
}

async function getUSPSToken(): Promise<string | null> {
	if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 60000) return cachedToken;
	const body = new URLSearchParams({
		grant_type: 'client_credentials',
		client_id: USPS_CONSUMER_KEY || '',
		client_secret: USPS_CONSUMER_SECRET || '',
		scope: 'addresses',
	});
	try {
		const res = await fetch(USPS_TOKEN_URL!, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: body.toString(),
		});
		if (!res.ok) throw new Error(`Token request failed: ${res.statusText}`);
		const data = await res.json();
		cachedToken = data.access_token;
		tokenExpiresAt = Date.now() + data.expires_in * 1000;
		return cachedToken;
	} catch (e) {
		console.error('Error fetching USPS token:', e);
		return null;
	}
}

function buildFormattedAddress(addr: any) {
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

	const p = new URLSearchParams();
	p.append('streetAddress', streetAddress);
	if (city) p.append('city', city);
	p.append('state', state || '');
	if (zipCode) p.append('ZIPCode', zipCode);

	let formattedAddress = '',
		statusFlag = false;
	const url = `${USPS_ADDRESS_URL}/address?${p.toString()}`;
	try {
		const res = await fetch(url, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
		if (!res.ok) throw new Error(`Non-200 response: ${res.status} ${res.statusText}`);
		const data = await res.json();
		if (data?.address) {
			formattedAddress = buildFormattedAddress(data.address);
			streetAddress = data.address.streetAddress
				? toTitleCase(data.address.streetAddress)
				: toTitleCase(streetAddress);
			city = data.address.city ? toTitleCase(data.address.city) : city ? toTitleCase(city) : undefined;
			state = data.address.state;
			zipCode = data.address.ZIPCode;
			statusFlag = true;
		}
	} catch (err) {
		errorMsg = `Error fetching USPS Address API: ${err instanceof Error ? err.message : String(err)}`;
		console.warn(streetAddress, city, state, zipCode, url, errorMsg);
	}

	return {
		location: cleanObject({
			streetAddress: streetAddress ? toTitleCase(streetAddress) : undefined,
			city: city ? toTitleCase(city) : undefined,
			state,
			zipCode,
			formattedAddress,
			unformattedAddress: unformatted,
		}) as AddressResult,
		status: statusFlag,
		error: errorMsg,
	};
}

// =====================================
// Google Maps: Geocoding
// =====================================

/**
 * parseAddressComponents now also returns `streetName` as the "route" portion,
 * separate from the combined streetAddress (number + route).
 */
function parseAddressComponents(components: any[]) {
	let streetNumber = '',
		route = '',
		city = '',
		state = '',
		zipCode = '';
	for (const c of components) {
		if (c.types.includes('street_number')) streetNumber = c.long_name;
		if (c.types.includes('route')) route = c.long_name;
		if (c.types.includes('locality') || c.types.includes('postal_town')) city = c.long_name;
		if (!city && c.types.includes('administrative_area_level_3')) city = c.long_name;
		if (!city && c.types.includes('sublocality')) city = c.long_name;
		if (c.types.includes('administrative_area_level_1')) state = c.short_name;
		if (c.types.includes('postal_code')) zipCode = c.long_name;
	}
	return {
		city,
		state,
		zipCode,
		streetAddress: [streetNumber, route].filter(Boolean).join(' '),
		streetName: route || undefined,
	};
}

function parseFirstGmapsResult(data: any) {
	if (!data || data.status !== 'OK' || !data.results?.length) return null;
	const best = data.results[0];
	const { lat, lng } = best.geometry.location;
	let formattedAddress = (best.formatted_address || '').replace(/,\s?USA$/, '');

	const { city, state, zipCode, streetAddress, streetName } = parseAddressComponents(
		best.address_components,
	);

	return {
		geo: { type: 'Point' as const, coordinates: [lng, lat] as [number, number] },
		formattedAddress,
		city,
		state,
		zipCode,
		streetAddress,
		streetName,
	};
}

async function fetchGeoCoordinates({ formattedAddress }: { formattedAddress: string }) {
	try {
		const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
			formattedAddress,
		)}&key=${GMAPS_API_KEY}`;
		const data = await (await fetch(url)).json();
		return parseFirstGmapsResult(data);
	} catch (err) {
		console.error('Error fetching geo coordinates:', err);
		return null;
	}
}

async function fetchAddressFromCoordinates(geo: Geo) {
	try {
		const [lng, lat] = geo.coordinates;
		const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GMAPS_API_KEY}`;
		const data = await (await fetch(url)).json();
		return parseFirstGmapsResult(data);
	} catch (err) {
		console.error('Error reverse geocoding:', err);
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
}): Promise<GeoCorrectionResponse> {
	let errorMsg: string | undefined;

	try {
		// Build or reuse the geo object
		const currentGeo: Geo | null =
			geo ||
			(typeof lat === 'number' && typeof lng === 'number' ? { type: 'Point', coordinates: [lng, lat] } : null);

		if (currentGeo) {
			const [x, y] = currentGeo.coordinates;
			// If coords are nonzero, see if we have a missing address
			if (!(x === 0 && y === 0)) {
				if (!formattedAddress) {
					const rev = await fetchAddressFromCoordinates(currentGeo);
					if (!rev) {
						errorMsg = 'Reverse geocoding failed: no address returned.';
						return {
							status: true,
							location: { geo: currentGeo },
							error: errorMsg,
						};
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
							locality: rev.city,
						},
						error: errorMsg,
					};
				}
				// If we already have an address, just return
				return { status: true, location: { geo: currentGeo, formattedAddress }, error: errorMsg };
			}
		}

		// If we made it here, either no geo or it's [0,0]. Check for formattedAddress
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
						locality: forwardData.city,
					},
					error: errorMsg,
				};
			}
			errorMsg = 'Failed to fetch valid geo coordinates with the provided formatted address.';
		}

		// Fallback if everything else fails
		const fallback: Geo = { type: 'Point', coordinates: [0, 0] };
		return {
			status: false,
			location: { geo: fallback, formattedAddress },
			error: errorMsg,
		};
	} catch (err) {
		errorMsg = `Error in ensureValidGeoCoordinates: ${err instanceof Error ? err.message : String(err)}`;
		console.error(errorMsg);
		return {
			status: false,
			location: { geo: { type: 'Point', coordinates: [0, 0] }, formattedAddress },
			error: errorMsg,
		};
	}
}

// =====================================
// COMBINED LOCATION CORRECTION
// =====================================
/**
 * Combines USPS address correction and Google Maps geo correction
 * to return an updated location object.
 *
 * NOTE: We store the final "city" from Google as "locality" if it's missing.
 */
export async function correctLocation(location: LocationReturn): Promise<any> {
	// 1) USPS address correction
	const uspsInput = {
		streetAddress: location.streetAddress,
		city: location.city,
		state: location.state,
		zipCode: location.zipCode,
	};
	const uspsResult: AddressCorrectionResponse = await correctAddress(uspsInput);

	// Merge the USPS-corrected location into the original
	let updatedLocation = { ...location, ...uspsResult.location };

	// Strip "County" from the county field, if present
	if (typeof updatedLocation.county === 'string') {
		updatedLocation.county = updatedLocation.county.replace(/\bCounty\b/gi, '').trim();
	}

	// 2) Google geo correction
	const geoInput = {
		geo: updatedLocation.geo, // might be undefined
		formattedAddress: updatedLocation.formattedAddress, // might be undefined
	};
	const geoResult: GeoCorrectionResponse = await ensureValidGeoCoordinates(geoInput);

	// Update location with geo data
	updatedLocation.geo = geoResult.location.geo;
	updatedLocation.formattedAddress = geoResult.location.formattedAddress || updatedLocation.formattedAddress;

	// If Google returned a city, store it in "locality" if missing
	if (!updatedLocation.locality && geoResult.location.city) {
		updatedLocation.locality = geoResult.location.city;
	}
	if (!updatedLocation.state && geoResult.location.state) {
		updatedLocation.state = geoResult.location.state;
	}
	if (!updatedLocation.zipCode && geoResult.location.zipCode) {
		updatedLocation.zipCode = geoResult.location.zipCode;
	}
	if (geoResult.location.streetAddress) {
		updatedLocation.streetAddress = geoResult.location.streetAddress;
	}
	if (geoResult.location.streetName) {
		updatedLocation.streetName = geoResult.location.streetName;
	}

	// Combine errors & statuses
	const error = uspsResult.error || geoResult.error;
	const status = uspsResult.status && geoResult.status;

	return { ...updatedLocation, status, error };
}

// -------------------------------------------------
// Start Application
// -------------------------------------------------
(async () => {
	try {
		// Create an Express app.
		const app = express();
		app.use(express.json());

		// ---------------------------------------------
		// Routes
		// ---------------------------------------------

		/**
		 * POST /api/location/correct
		 * Accepts a LocationReturn-like JSON payload and returns the corrected location
		 */
		app.post('/api/location/correct', async (req: Request, res: Response) => {
			try {
				const locationInput: LocationReturn = req.body;
				const corrected = await correctLocation(locationInput);
				res.json(corrected);
			} catch (err) {
				console.error('[ERROR] /api/location/correct:', err);
				res.status(500).json({ error: 'Internal server error' });
			}
		});

		/**
		 * Simple health check route.
		 */
		app.get('/health', (_req: Request, res: Response) => res.send('OK'));

		app.listen(Number(PORT), () => {
			console.log(`Server running on port ${PORT}`);
		});
	} catch (error) {
		console.error('[ERROR] Failed to start server:', error);
		process.exit(1);
	}
})();

// -------------------------------------------------
// Graceful Shutdown
// -------------------------------------------------
const gracefulShutdown = async () => {
	console.log('\n[SHUTDOWN] Caught termination signal. Closing resources...\n');
	process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
