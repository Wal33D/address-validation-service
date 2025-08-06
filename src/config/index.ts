import dotenv from 'dotenv';
import { ValidationError } from '../utils/errors';

// Suppress dotenv logging by intercepting console.log temporarily
const originalLog = console.log;
console.log = () => {};
dotenv.config();
console.log = originalLog;

interface Config {
  // Server
  port: number;
  nodeEnv: string;

  // USPS API
  usps: {
    tokenUrl: string;
    addressUrl: string;
    consumerKey: string;
    consumerSecret: string;
  };

  // Google Maps API
  googleMaps: {
    apiKey: string;
  };

  // Security
  security: {
    enableRateLimiting: boolean;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
    corsAllowedOrigins: string[];
  };

  // Cache
  cache: {
    geocodingCacheSize: number;
    geocodingCacheTTL: number; // seconds
  };

  // Logging
  logging: {
    level: string;
  };
}

function validateConfig(): Config {
  const requiredEnvVars = [
    'USPS_TOKEN_URL',
    'USPS_ADDRESS_URL',
    'USPS_CONSUMER_KEY',
    'USPS_CONSUMER_SECRET',
    'GMAPS_API_KEY',
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new ValidationError(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    port: parseInt(process.env['PORT'] || '3715', 10),
    nodeEnv: process.env['NODE_ENV'] || 'development',

    usps: {
      tokenUrl: process.env['USPS_TOKEN_URL']!,
      addressUrl: process.env['USPS_ADDRESS_URL']!,
      consumerKey: process.env['USPS_CONSUMER_KEY']!,
      consumerSecret: process.env['USPS_CONSUMER_SECRET']!,
    },

    googleMaps: {
      apiKey: process.env['GMAPS_API_KEY']!,
    },

    security: {
      enableRateLimiting: process.env['ENABLE_RATE_LIMITING'] !== 'false',
      rateLimitWindowMs: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '60000', 10),
      rateLimitMaxRequests: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100', 10),
      corsAllowedOrigins: process.env['CORS_ALLOWED_ORIGINS']?.split(',') || [
        'http://localhost:3000',
      ],
    },

    cache: {
      geocodingCacheSize: parseInt(process.env['GEOCODING_CACHE_SIZE'] || '1000', 10),
      geocodingCacheTTL: parseInt(process.env['GEOCODING_CACHE_TTL'] || '3600', 10),
    },

    logging: {
      level: process.env['LOG_LEVEL'] || 'info',
    },
  };
}

export const config = validateConfig();
