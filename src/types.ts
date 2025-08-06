export interface Geo {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface LocationReturn {
  unformattedAddress: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  county?: string;
  directions?: string;
  schoolDistrict?: string;
  streetNumber?: string;
  streetDirPrefix?: string;
  streetName?: string;
  streetSuffix?: string;
  streetAddress?: string;
  streetDirSuffix?: string;
  unitNumber?: string;
  locality?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  municipality?: string;
  geo: Geo;
}

// USPS API Types
export interface USPSTokenResponse {
  access_token: string;
  expires_in: number;
}

export interface USPSAddress {
  streetAddress?: string;
  streetAddressAbbreviation?: string;
  city?: string;
  state?: string;
  ZIPCode?: string;
}

export interface USPSAddressResponse {
  address?: USPSAddress;
}

// Google Maps API Types
export interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface GoogleGeometry {
  location: {
    lat: number;
    lng: number;
  };
}

export interface GoogleResult {
  address_components: GoogleAddressComponent[];
  formatted_address: string;
  geometry: GoogleGeometry;
}

export interface GoogleMapsResponse {
  status: string;
  results: GoogleResult[];
}

// Internal Types
export interface ParsedAddressComponents {
  city: string;
  county: string;
  state: string;
  zipCode: string;
  streetAddress: string;
  streetName?: string;
  locality?: string;
}

export interface GeocodingResult {
  geo: Geo;
  formattedAddress: string;
  city?: string;
  county?: string;
  state?: string;
  zipCode?: string;
  streetAddress?: string;
  streetName?: string;
  locality?: string;
}

export interface CountyResult {
  county: string;
}

export interface GeoValidationResult {
  status: boolean;
  location: {
    geo: Geo;
    formattedAddress?: string;
    city?: string;
    county?: string;
    state?: string;
    zipCode?: string;
    streetAddress?: string;
    streetName?: string;
  };
  error?: string;
}

export interface LocationCorrectionResult {
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  county?: string;
  geo: Geo;
  formattedAddress?: string;
  unformattedAddress?: string;
  status: boolean;
  error?: string;
}

// Request/Response Types
export interface ValidateLocationRequest {
  streetAddress: string;
  city?: string;
  state?: string;
  zipCode?: string;
  geo?: Geo;
  formattedAddress?: string;
  [key: string]: unknown;
}

export interface AddressInput {
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface AddressResult {
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
