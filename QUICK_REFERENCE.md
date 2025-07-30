# Location Correction Service - Quick Reference

## 🚀 Quick Start
```bash
# Development
npm install
npm run dev

# Production
npm run build
NODE_ENV=production npm start

# Testing
npm test
```

## 🔧 Environment Variables
```bash
# Required
USPS_TOKEN_URL=https://api.usps.com/oauth2/v3/token
USPS_ADDRESS_URL=https://api.usps.com/addresses/v3
USPS_CONSUMER_KEY=your_key
USPS_CONSUMER_SECRET=your_secret
GMAPS_API_KEY=your_google_maps_key

# Optional
PORT=3715
LOG_LEVEL=info
GEOCODING_CACHE_SIZE=1000
GEOCODING_CACHE_TTL=3600
```

## 📡 API Endpoints

### Validate Single Address
```bash
curl -X POST http://localhost:3715/validate-location \
  -H "Content-Type: application/json" \
  -d '{
    "streetAddress": "1600 Pennsylvania Ave NW",
    "city": "Washington",
    "state": "DC",
    "zipCode": "20500"
  }'
```

### Batch Validation
```bash
curl -X POST http://localhost:3715/validate-locations \
  -H "Content-Type: application/json" \
  -d '{
    "locations": [
      {"streetAddress": "350 5th Ave", "city": "New York", "state": "NY", "zipCode": "10118"},
      {"streetAddress": "1 Microsoft Way", "city": "Redmond", "state": "WA", "zipCode": "98052"}
    ]
  }'
```

### Health Check
```bash
curl http://localhost:3715/health
```

### Cache Stats
```bash
curl http://localhost:3715/cache/stats
```

## 🛠️ Key Features

### Address Preprocessing
- Adds periods to abbreviations: `N` → `N.`, `St` → `St.`
- Corrects city names: `St Joseph` → `Saint Joseph`
- ZIP-to-city mapping: `McBride MI 48852` → `Mount Pleasant MI 48852`

### Request Deduplication
- Prevents duplicate concurrent requests
- 5-second TTL by default
- Tracks hits/misses

### Circuit Breaker
- Opens after 3 failures
- Resets after 5 seconds
- Half-open state for testing recovery

### Caching
- LRU cache with 1000 entries
- 1-hour TTL
- Geocoding results cached

## 📊 Monitoring

### Health Response
```json
{
  "status": "ok",
  "timestamp": "2025-07-30T19:21:18.032Z",
  "uptime": 29755.38,
  "environment": "production",
  "cache": {
    "size": 42,
    "capacity": 1000,
    "utilization": 4.2
  },
  "circuitBreakers": {
    "usps": { "state": "CLOSED", "failures": 0 },
    "googleMaps": { "state": "CLOSED", "failures": 0 }
  }
}
```

## 🐛 Debugging

### Enable Debug Logs
```bash
LOG_LEVEL=debug npm run dev
```

### Common Issues
1. **USPS 400 Errors**: Check city name and address format
2. **Circuit Open**: External API is down, wait for reset
3. **No County**: Not all addresses have county data

## 📚 Documentation
- API Docs: Open `api-docs.html` in browser
- OpenAPI Spec: `openapi.yaml`
- Full README: `README.md`
- Deployment: `DEPLOYMENT_CHECKLIST.md`

## 🔗 Links
- GitHub: https://github.com/Wal33D/candycomp-location-correction
- Issues: https://github.com/Wal33D/candycomp-location-correction/issues