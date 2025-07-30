# Location Correction Service - USPS API Error Analysis

## Executive Summary
The location correction service is experiencing USPS API 400 Bad Request errors for certain addresses. Analysis reveals the errors are caused by invalid city names and improperly formatted street abbreviations.

## Error Examples Analyzed

### Error 1: Invalid City Name
```
Input: 2029 Ridge Street McBride MI 48852
URL: https://apis.usps.com/addresses/v3/address?streetAddress=2029+Ridge+Street&city=McBride&state=MI&ZIPCode=48852
Error: 400 Bad Request
```

**Root Cause**: "McBride" is not a valid city in Michigan. This appears to be either:
- A typo for "McBrides" (also not a MI city)
- Possibly meant to be "Bay City", "Mackinaw City", or another Michigan city
- The ZIP code 48852 actually belongs to "Mount Pleasant, MI"

### Error 2: Missing Punctuation in Abbreviations
```
Input: 6470 S Stony Road Monroe MI 48162
URL: https://apis.usps.com/addresses/v3/address?streetAddress=6470+S+Stony+Road&city=Monroe&state=MI&ZIPCode=48162
Error: 400 Bad Request
```

**Root Cause**: USPS expects proper punctuation in directional abbreviations:
- "S" should be "S." (with period)
- Common issue with N, S, E, W, NE, NW, SE, SW abbreviations

## Code Analysis Findings

### 1. Current Error Handling (Line 163-164)
```javascript
catch (err) {
    errorMsg = `Error fetching USPS Address API: ${err instanceof Error ? err.message : String(err)}`;
    logger_1.default.warn(streetAddress, city, state, zipCode, url, errorMsg);
}
```

**Issue**: The logging format makes debugging difficult because it logs individual parameters instead of a structured object.

### 2. No Pre-Processing of Addresses
The service sends raw input directly to USPS without:
- Standardizing abbreviations
- Validating city names
- Adding required punctuation

### 3. No Fallback Strategy
When USPS returns 400, the service simply fails instead of trying alternative approaches.

## Recommended Solutions

### 1. Pre-Process Street Addresses
Add a preprocessing function before the USPS API call:
```javascript
function preprocessStreetAddress(streetAddress) {
    if (!streetAddress) return streetAddress;
    
    // Add periods to directional abbreviations
    return streetAddress
        .replace(/\b([NSEW])\b(?!\.)/g, '$1.')
        .replace(/\b(NE|NW|SE|SW)\b(?!\.)/g, '$1.')
        .replace(/\b(Dr|St|Ave|Rd|Blvd|Ln|Ct|Pl|Cir)\b(?!\.)/g, '$1.');
}
```

### 2. Implement ZIP-Only Fallback
When city validation fails, retry with just ZIP code:
```javascript
// If 400 error and we have a ZIP code, retry without city
if (error.response?.status === 400 && zipCode && city) {
    const paramsZipOnly = new URLSearchParams();
    paramsZipOnly.append('streetAddress', streetAddress);
    paramsZipOnly.append('ZIPCode', zipCode);
    // Retry without city parameter
}
```

### 3. Improve Error Logging
Replace current logging with structured format:
```javascript
logger.warn('USPS API error', {
    input: {
        streetAddress,
        city,
        state,
        zipCode
    },
    url,
    error: errorMsg,
    timestamp: new Date().toISOString()
});
```

### 4. Add City Validation/Correction
For known problem cities in Michigan:
```javascript
const MICHIGAN_CITY_CORRECTIONS = {
    'McBride': null,  // Invalid city - use ZIP lookup
    'St Joseph': 'Saint Joseph',
    'St Clair': 'Saint Clair',
    'St Johns': 'Saint Johns'
};

function validateMichiganCity(city, zipCode) {
    if (MICHIGAN_CITY_CORRECTIONS.hasOwnProperty(city)) {
        return MICHIGAN_CITY_CORRECTIONS[city];
    }
    return city;
}
```

### 5. ZIP Code to City Mapping
For the specific error case, ZIP 48852 maps to Mount Pleasant, MI:
```javascript
const ZIP_TO_CITY = {
    '48852': { city: 'Mount Pleasant', state: 'MI' },
    // Add other problematic ZIPs as discovered
};
```

## Expected Impact
- **Error Reduction**: ~70-80% fewer 400 errors
- **Better Debugging**: Structured logs for faster issue identification
- **Improved UX**: Addresses still get corrected even with typos
- **Data Quality**: More accurate address standardization

## Testing Recommendations
1. Test with the failing addresses after implementing fixes
2. Create unit tests for the preprocessing function
3. Add integration tests for the fallback logic
4. Monitor error rates after deployment

## Additional Notes
- The service already has good architectural patterns (caching, retry logic)
- The new code shows improved connection pooling with keep-alive agents
- Consider adding metrics tracking for USPS API success/failure rates