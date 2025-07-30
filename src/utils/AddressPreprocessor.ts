import logger from './logger';

// ZIP code to city mappings for known problematic cases
const ZIP_TO_CITY: Record<string, { city: string; state: string }> = {
    '48852': { city: 'Mount Pleasant', state: 'MI' },
    // Add other problematic ZIPs as discovered
};

// City name corrections for known issues
const CITY_CORRECTIONS: Record<string, Record<string, string | null>> = {
    'MI': {
        'McBride': null,  // Invalid city - use ZIP lookup
        'St Joseph': 'Saint Joseph',
        'St Clair': 'Saint Clair',
        'St Johns': 'Saint Johns',
        'St Ignace': 'Saint Ignace',
        'St Louis': 'Saint Louis',
        'Ste Marie': 'Sault Ste Marie',
        'Sault Ste Marie': 'Sault Ste Marie'
    },
    // Add other states as needed
};

export class AddressPreprocessor {
    /**
     * Preprocess street address to add required punctuation
     */
    preprocessStreetAddress(streetAddress: string): string {
        if (!streetAddress) return streetAddress;
        
        // Add periods to directional abbreviations
        let processed = streetAddress
            // Single directionals (N, S, E, W)
            .replace(/\b([NSEW])\b(?!\.)/g, '$1.')
            // Compound directionals (NE, NW, SE, SW)
            .replace(/\b(NE|NW|SE|SW)\b(?!\.)/g, '$1.')
            // Common street type abbreviations
            .replace(/\b(Dr|St|Ave|Rd|Blvd|Ln|Ct|Pl|Cir|Pkwy|Hwy|Ter|Way)\b(?!\.)/g, '$1.')
            // Fix common spacing issues
            .replace(/\s+/g, ' ')
            .trim();

        logger.debug('Preprocessed street address', { 
            original: streetAddress, 
            processed 
        });

        return processed;
    }

    /**
     * Validate and correct city name
     */
    validateCity(city: string | undefined, state: string | undefined, zipCode: string | undefined): string | undefined {
        if (!city) {
            // Try to get city from ZIP code
            if (zipCode && ZIP_TO_CITY[zipCode]) {
                logger.info(`Using city from ZIP code mapping: ${zipCode} -> ${ZIP_TO_CITY[zipCode].city}`);
                return ZIP_TO_CITY[zipCode].city;
            }
            return undefined;
        }

        // Check for city corrections by state
        if (state) {
            const stateUpper = state.toUpperCase();
            const corrections = CITY_CORRECTIONS[stateUpper];
            
            if (corrections) {
                const normalizedCity = city.trim();
                
                if (corrections.hasOwnProperty(normalizedCity)) {
                    const correctedCity = corrections[normalizedCity];
                    
                    if (correctedCity === null) {
                        // Invalid city - try ZIP lookup
                        if (zipCode && ZIP_TO_CITY[zipCode]) {
                            logger.warn(`Invalid city "${city}" corrected to "${ZIP_TO_CITY[zipCode].city}" using ZIP ${zipCode}`);
                            return ZIP_TO_CITY[zipCode].city;
                        }
                        logger.warn(`Invalid city "${city}" with no ZIP mapping available`);
                        return undefined;
                    } else {
                        logger.info(`City name corrected: "${city}" -> "${correctedCity}"`);
                        return correctedCity;
                    }
                }
            }
        }

        return city;
    }

    /**
     * Preprocess complete address
     */
    preprocessAddress(params: {
        streetAddress?: string;
        city?: string;
        state?: string;
        zipCode?: string;
    }): {
        streetAddress?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        cityFromZip?: boolean;
    } {
        const result: any = {
            ...params,
            cityFromZip: false
        };

        // Preprocess street address
        if (params.streetAddress) {
            result.streetAddress = this.preprocessStreetAddress(params.streetAddress);
        }

        // Validate and correct city
        const originalCity = params.city;
        result.city = this.validateCity(params.city, params.state, params.zipCode);
        
        // Track if city came from ZIP
        if (!originalCity && result.city) {
            result.cityFromZip = true;
        }

        // Normalize state to uppercase
        if (params.state) {
            result.state = params.state.toUpperCase();
        }

        return result;
    }

    /**
     * Check if we should retry without city
     */
    shouldRetryWithoutCity(error: any, hasCity: boolean, hasZipCode: boolean): boolean {
        // Only retry if we have both city and ZIP, and got a 400 error
        return error.response?.status === 400 && hasCity && hasZipCode;
    }

    /**
     * Add a ZIP to city mapping
     */
    addZipMapping(zipCode: string, city: string, state: string): void {
        ZIP_TO_CITY[zipCode] = { city, state };
        logger.info(`Added ZIP mapping: ${zipCode} -> ${city}, ${state}`);
    }

    /**
     * Add a city correction
     */
    addCityCorrection(state: string, incorrectCity: string, correctCity: string | null): void {
        if (!CITY_CORRECTIONS[state]) {
            CITY_CORRECTIONS[state] = {};
        }
        CITY_CORRECTIONS[state][incorrectCity] = correctCity;
        logger.info(`Added city correction for ${state}: "${incorrectCity}" -> "${correctCity}"`);
    }
}

// Export singleton instance
export const addressPreprocessor = new AddressPreprocessor();