# Address Validation Service

High-performance address validation and geocoding service using USPS and Google Maps APIs.

## Overview

Provides address standardization and geocoding for the CandyComp platform. Combines USPS official address validation with Google Maps geocoding for accurate property location data. Built with TypeScript and Express, featuring token caching and optimized for real estate applications.

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API credentials

# Run development server
npm run dev

# Run production
npm start
```

## Configuration

Required environment variables:

| Variable              | Description                  | Example          |
| --------------------- | ---------------------------- | ---------------- |
| `PORT`                | Service port                 | `3715`           |
| `USPS_CLIENT_ID`      | USPS Web Tools Client ID     | `your-client-id` |
| `USPS_CLIENT_SECRET`  | USPS Web Tools Client Secret | `your-secret`    |
| `GOOGLE_MAPS_API_KEY` | Google Maps API key          | `AIza...`        |
| `ALLOWED_IPS`         | Comma-separated allowed IPs  | `::1,127.0.0.1`  |

## API Reference

### Endpoints

#### `POST /validate`

Validate and standardize an address

**Request Body:**

```json
{
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zip": "10001"
}
```

**Response:**

```json
{
  "valid": true,
  "normalized": {
    "address": "123 MAIN ST",
    "city": "NEW YORK",
    "state": "NY",
    "zip": "10001-1234"
  },
  "coordinates": {
    "lat": 40.7128,
    "lng": -74.006
  }
}
```

#### `POST /geocode`

Forward geocode an address

**Request Body:**

```json
{
  "address": "123 Main St, New York, NY 10001"
}
```

**Response:**

```json
{
  "lat": 40.7128,
  "lng": -74.006,
  "formattedAddress": "123 Main St, New York, NY 10001, USA",
  "placeId": "ChIJ..."
}
```

#### `POST /reverse-geocode`

Get address from coordinates

**Request Body:**

```json
{
  "lat": 40.7128,
  "lng": -74.006
}
```

**Response:**

```json
{
  "address": "123 Main St",
  "city": "New York",
  "state": "NY",
  "zip": "10001",
  "formattedAddress": "123 Main St, New York, NY 10001, USA"
}
```

#### `GET /health`

Health check endpoint

## Development

```bash
# Run with hot reload
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Format code
npm run format
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Architecture

### Key Features

- **USPS Integration**: Official USPS Web Tools API for address standardization
- **Google Maps API**: Geocoding and reverse geocoding
- **Token Management**: Automatic USPS OAuth token refresh
- **IP Restriction**: Security through IP whitelisting
- **Error Handling**: Comprehensive error handling with fallbacks
- **Response Caching**: In-memory caching for duplicate requests

### Service Flow

1. Receive address validation request
2. Authenticate with USPS (cached token if available)
3. Validate address through USPS
4. Geocode through Google Maps
5. Return standardized address with coordinates

## Deployment

Runs as a local service on port 3715:

```bash
# Start service
npm start

# Using PM2
pm2 start ecosystem.config.js
pm2 logs address-validation-service
```

## License

© 2024 Waleed Judah. All rights reserved.
