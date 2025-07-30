// Improved type definitions for strict TypeScript

export interface Geo {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
}

export interface LocationReturn {
    unformattedAddress: string;
    formattedAddress: string;
    latitude: number;
    longitude: number;
    county?: string | undefined;
    directions?: string | undefined;
    schoolDistrict?: string | undefined;
    streetNumber?: string | undefined;
    streetDirPrefix?: string | undefined;
    streetName?: string | undefined;
    streetSuffix?: string | undefined;
    streetAddress?: string | undefined;
    streetDirSuffix?: string | undefined;
    unitNumber?: string | undefined;
    locality?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    zipCode?: string | undefined;
    municipality?: string | undefined;
    geo: Geo;
}

export interface ValidateLocationRequest {
    streetAddress: string;
    city?: string | undefined;
    state?: string | undefined;
    zipCode?: string | undefined;
    geo?: Geo | undefined;
    formattedAddress?: string | undefined;
    [key: string]: unknown;
}

export interface AddressInput {
    streetAddress?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    zipCode?: string | undefined;
}

export interface AddressResult {
    streetAddress?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    zipCode?: string | undefined;
    formattedAddress?: string | undefined;
    unformattedAddress?: string | undefined;
}

export interface AddressCorrectionResponse {
    location: AddressResult;
    status: boolean;
    error?: string | undefined;
}

export interface GeoCorrectionResponse {
    status: boolean;
    location: {
        geo: Geo;
        formattedAddress?: string | undefined;
        city?: string | undefined;
        state?: string | undefined;
        zipCode?: string | undefined;
        streetAddress?: string | undefined;
        streetName?: string | undefined;
    };
    error?: string | undefined;
}

// API Response types
export interface USPSTokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

export interface USPSAddressResponse {
    address?: {
        streetAddress?: string;
        streetAddressAbbreviation?: string;
        city?: string;
        state?: string;
        ZIPCode?: string;
        ZIPPlus4?: string;
    };
}

export interface GoogleGeocodingResult {
    address_components: Array<{
        long_name: string;
        short_name: string;
        types: string[];
    }>;
    formatted_address: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        };
    };
}

export interface GoogleGeocodingResponse {
    results: GoogleGeocodingResult[];
    status: string;
}