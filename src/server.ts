import dotenv from 'dotenv';
import express, { Request, Response } from 'express';

import { LocationReturn } from './types';
import { localOnlyMiddleware } from './middleware/localOnlyMiddleware';

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
} = process.env;

if (
	!USPS_TOKEN_URL ||
	!USPS_ADDRESS_URL ||
	!USPS_CONSUMER_KEY ||
	!USPS_CONSUMER_SECRET ||
	!GMAPS_API_KEY
) {
	throw new Error(
		'Missing required environment variables for USPS or Google Maps.',
	);
}

const PORT = 3715;

// =====================================
// Types and Interfaces
// =====================================

export interface Geo {
	type: 'Point';
	coordinates: [number, number]; // [lng, lat]
}



/**
 * Payload accepted by POST /validate-location
 *
 * – `streetAddress` is required.
 * – You must supply **either** `city` **or** `zipCode` (or both) so USPS can
 *   validate it.
 * – Any other keys from `LocationReturn` are forwarded to Google or merged into
 *   the final response when relevant.
 */
export interface ValidateLocationRequest {
	streetAddress: string;
	city?: string;
	state?: string;
	zipCode?: string;
	geo?: Geo;
	formattedAddress?: string;
	// allow arbitrary extra keys
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

/**
 * Includes optional `streetAddress` and `streetName` so the final geocoded
 * location can return them if found.
 */
export interface GeoCorrectionResponse {
	status: boolean;
	location: {
		geo: Geo;
		formattedAddress?: string;
		city?: string;
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
	// remove undefined or empty‑string properties
	return Object.fromEntries(
		Object.entries(obj).filter(([, v]) => v !== undefined && v !== ''),
	) as Partial<T>;
}

async function getUSPSToken(): Promise<string | null> {
	if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 60_000) {
		return cachedToken;
	}

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
	} catch (err) {
		console.error('Error fetching USPS token:', err);
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

	const p = new URLSearchParams();
	p.append('streetAddress', streetAddress);
	if (city) p.append('city', city);
	p.append('state', state || '');
	if (zipCode) p.append('ZIPCode', zipCode);

	let formattedAddress = '',
		statusFlag = false;
	const url = `${USPS_ADDRESS_URL}/address?${p.toString()}`;

	try {
		const res = await fetch(url, {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok)
			throw new Error(`Non‑200 response: ${res.status} ${res.statusText}`);
		const data = await res.json();

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
		errorMsg = `Error fetching USPS Address API: ${err instanceof Error ? err.message : String(err)
			}`;
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

function parseAddressComponents(components: any[]) {
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
						error: errorMsg,
					};
				}
				return { status: true, location: { geo: currentGeo, formattedAddress }, error: errorMsg };
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
					error: errorMsg,
				};
			}
			errorMsg =
				'Failed to fetch valid geo coordinates with the provided formatted address.';
		}

		const fallback: Geo = { type: 'Point', coordinates: [0, 0] };
		return { status: false, location: { geo: fallback, formattedAddress }, error: errorMsg };
	} catch (err) {
		errorMsg = `Error in ensureValidGeoCoordinates: ${err instanceof Error ? err.message : String(err)
			}`;
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

export async function correctLocation(location: LocationReturn): Promise<any> {
	// 1) USPS address correction
	const uspsInput: AddressInput = {
		streetAddress: location.streetAddress,
		city: location.city,
		state: location.state,
		zipCode: location.zipCode,
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

// -------------------------------------------------
// Start Application
// -------------------------------------------------
(async () => {
	try {
		const app = express();
		app.use(express.json());
		// ---------- Health check ----------
		// Responds with HTTP 200 and a tiny JSON payload. We register this **before**
		// the local‑only middleware so external orchestrators (Docker‑Compose,
		// Kubernetes, Heroku, etc.) can still probe the endpoint.
		app.get('/health', (_req: Request, res: Response) => {
			res.status(200).json({ status: 'ok' });
		});

		app.use(localOnlyMiddleware);

		/**
		 * POST /validate-location
		 * Accepts a LocationReturn-like JSON payload and returns the corrected location
		 */
		app.post(
			'/validate-location',
			async (
				req: Request<{}, {}, ValidateLocationRequest>,
				res: Response,
			) => {
				try {
					const locationInput = req.body as unknown as LocationReturn;
					const corrected = await correctLocation(locationInput);
					console.log(corrected)
					res.json(corrected);
				} catch (err) {
					console.error('[ERROR] /validate-location:', err);
					res.status(500).json({ error: 'Internal server error' });
				}
			},
		);

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
	console.log(
		'\n[SHUTDOWN] Caught termination signal. Closing resources...\n',
	);
	process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
