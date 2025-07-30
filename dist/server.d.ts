import { LocationReturn, Geo } from './types';
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
export declare function correctAddress({ streetAddress, city, state, zipCode, }: AddressInput): Promise<AddressCorrectionResponse>;
export declare function ensureValidGeoCoordinates({ lat, lng, geo, formattedAddress, }: {
    lat?: number;
    lng?: number;
    geo?: Geo;
    formattedAddress?: string;
}): Promise<any>;
export declare function correctLocation(location: LocationReturn): Promise<any>;
declare const app: import("express-serve-static-core").Express;
export { app };
//# sourceMappingURL=server.d.ts.map