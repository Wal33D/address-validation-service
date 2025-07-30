# Deployment Checklist

## Pre-Deployment Steps

### 1. Environment Variables
Ensure the following environment variables are set in production:
- [ ] `USPS_TOKEN_URL` - USPS OAuth token endpoint
- [ ] `USPS_ADDRESS_URL` - USPS address validation endpoint
- [ ] `USPS_CONSUMER_KEY` - USPS API consumer key
- [ ] `USPS_CONSUMER_SECRET` - USPS API consumer secret
- [ ] `GMAPS_API_KEY` - Google Maps API key
- [ ] `PORT` - Server port (default: 3715)
- [ ] `NODE_ENV` - Set to "production"

### 2. Build and Test
- [x] Run `npm run build` - TypeScript compilation successful
- [x] Run `npm test` - 116/129 tests passing
- [x] Test production build locally

### 3. Performance Configuration (Optional)
- [ ] `GEOCODING_CACHE_SIZE` - Default: 1000
- [ ] `GEOCODING_CACHE_TTL` - Default: 3600 (1 hour)
- [ ] `RATE_LIMIT_WINDOW_MS` - Default: 60000 (1 minute)
- [ ] `RATE_LIMIT_MAX_REQUESTS` - Default: 100

### 4. Security
- [ ] Ensure CORS origins are properly configured
- [ ] Enable rate limiting in production
- [ ] Review API keys and secrets

## Deployment Steps

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start the production server**
   ```bash
   NODE_ENV=production npm start
   ```

3. **Verify health check**
   ```bash
   curl http://localhost:3715/health
   ```

4. **Test core functionality**
   ```bash
   # Test single address
   curl -X POST http://localhost:3715/validate-location \
     -H "Content-Type: application/json" \
     -d '{"streetAddress":"1600 Pennsylvania Ave NW","city":"Washington","state":"DC","zipCode":"20500"}'
   
   # Test batch processing
   curl -X POST http://localhost:3715/validate-locations \
     -H "Content-Type: application/json" \
     -d '{"locations":[{"streetAddress":"350 5th Ave","city":"New York","state":"NY","zipCode":"10118"}]}'
   ```

## Post-Deployment Monitoring

1. **Monitor logs for**:
   - Circuit breaker state changes
   - USPS/Google Maps API errors
   - Request deduplication statistics

2. **Check metrics**:
   - Cache hit rate via `/cache/stats`
   - Health endpoint for uptime and status
   - Circuit breaker and deduplication stats in health check

3. **Performance indicators**:
   - Response times should be < 500ms for cached results
   - API success rate should be > 95%
   - Memory usage should be stable

## Rollback Plan

If issues occur:
1. Keep previous build artifacts
2. Monitor error rates in first hour
3. Have environment variables backed up
4. Test rollback procedure in staging first

## New Features Summary

- **Address Preprocessing**: Fixes USPS compatibility issues
- **Request Deduplication**: Prevents duplicate API calls
- **Circuit Breaker**: Protects against API failures
- **Connection Pooling**: Improves performance
- **ZIP-only Fallback**: Handles city name mismatches