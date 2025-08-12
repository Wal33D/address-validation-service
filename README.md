# Address Validation Service

High-performance address validation and geocoding service using USPS and Google Maps APIs.

## Overview

Provides address standardization and geocoding for the CandyComp platform. Combines USPS official address validation with Google Maps geocoding for accurate property location data. Built with TypeScript and Express, featuring token caching and optimized for real estate applications.

## Features

- **USPS Integration** - Official USPS Web Tools API for address standardization
- **Google Maps Geocoding** - Forward and reverse geocoding
- **Token Management** - Automatic USPS OAuth token refresh
- **IP Restriction** - Security through IP whitelisting
- **Response Caching** - In-memory caching for duplicate requests
- **TypeScript** - Full type safety with zero errors/warnings

## Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API credentials

# Build TypeScript
npm run build

# Run development server
npm run dev

# Run production
npm start
```

## Environment Variables

| Variable            | Description                  | Example        |
| ------------------- | ---------------------------- | -------------- |
| PORT                | Service port                 | 3715           |
| USPS_CLIENT_ID      | USPS Web Tools Client ID     | your-client-id |
| USPS_CLIENT_SECRET  | USPS Web Tools Client Secret | your-secret    |
| GOOGLE_MAPS_API_KEY | Google Maps API key          | AIza...        |
| ALLOWED_IPS         | Comma-separated allowed IPs  | ::1,127.0.0.1  |
| NODE_ENV            | Environment mode             | production     |

## API Endpoints

### `POST /validate`

Validate and standardize an address

**Request:**

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

### `POST /geocode`

Forward geocode an address

**Request:**

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

### `POST /reverse-geocode`

Get address from coordinates

**Request:**

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

### `GET /health`

Health check endpoint

## Development

```bash
# Run with hot reload
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint
npm run lint:fix

# Format code
npm run format
npm run format:check

# Clean build
npm run clean
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

### Service Flow

1. Receive address validation request
2. Authenticate with USPS (cached token if available)
3. Validate address through USPS
4. Geocode through Google Maps
5. Return standardized address with coordinates

### Key Components

- **USPS Client** - Handles OAuth token management and API calls
- **Google Maps Client** - Geocoding and reverse geocoding
- **Cache Manager** - In-memory caching for performance
- **IP Middleware** - Security through IP whitelisting
- **Error Handler** - Comprehensive error handling with fallbacks

## Production Deployment

### Using PM2

```bash
# Build for production
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# View logs
pm2 logs service-address-validation

# Restart
pm2 restart service-address-validation
```

### Manual Start

```bash
npm start
```

## GitHub Actions Deployment

The repository includes a GitHub Actions workflow that automatically builds and deploys the service when you push to the `main` branch.

### Required GitHub Secrets

Configure these secrets in your GitHub repository settings:

#### SSH Connection

- `LINODE_HOST` - Server IP or hostname
- `LINODE_USERNAME` - SSH username (e.g., `puppeteer-user`)
- `LINODE_PASSWORD` - SSH password for authentication

#### Application Environment

- `USPS_CLIENT_ID` - USPS Web Tools Client ID
- `USPS_CLIENT_SECRET` - USPS Web Tools Client Secret
- `GOOGLE_MAPS_API_KEY` - Google Maps API key
- `ALLOWED_IPS` - Comma-separated allowed IPs
- `NODE_ENV` - Environment setting (e.g., `production`)

### Deployment Process

1. Builds TypeScript project
2. Copies built files to server
3. Creates `.env` file from GitHub secrets
4. Installs production dependencies
5. Restarts PM2 process

## Performance

- **Caching** - In-memory cache for duplicate requests
- **Token Reuse** - USPS OAuth tokens cached until expiry
- **Connection Pooling** - Optimized HTTP connections
- **Async Processing** - Non-blocking operations

## Security

- **IP Whitelisting** - Only configured IPs can access
- **Input Validation** - All inputs validated before processing
- **Error Sanitization** - Sensitive data removed from error responses
- **Rate Limiting** - Built-in request throttling

## License

© 2024 Waleed Judah. All rights reserved.
