export interface Geo {
    type: "Point";
    coordinates: [number, number];
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
//# sourceMappingURL=types.d.ts.map