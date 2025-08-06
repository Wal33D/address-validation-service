// Custom error classes for the location correction service

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class ExternalAPIError extends AppError {
  public readonly service: string;

  constructor(service: string, message: string, statusCode: number = 502) {
    super(`${service} API Error: ${message}`, statusCode);
    this.service = service;
  }
}

export class USPSError extends ExternalAPIError {
  constructor(message: string) {
    super('USPS', message);
  }
}

export class GoogleMapsError extends ExternalAPIError {
  constructor(message: string) {
    super('Google Maps', message);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

export class TimeoutError extends AppError {
  constructor(service: string) {
    super(`Request to ${service} timed out`, 504);
  }
}
