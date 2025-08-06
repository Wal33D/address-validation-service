import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../utils/errors';

// Validation schemas
export const schemas = {
  validateLocation: Joi.object({
    streetAddress: Joi.string().min(1).max(200).required(),
    city: Joi.string().min(1).max(100),
    state: Joi.string().length(2).uppercase(),
    zipCode: Joi.string().pattern(/^\d{5}(-\d{4})?$/),
    geo: Joi.object({
      type: Joi.string().valid('Point').required(),
      coordinates: Joi.array().items(Joi.number()).length(2).required(),
    }),
    formattedAddress: Joi.string().max(500),
    county: Joi.string().max(100),
    unformattedAddress: Joi.string().max(500),
    latitude: Joi.number().min(-90).max(90),
    longitude: Joi.number().min(-180).max(180),
  }).or('city', 'zipCode', 'geo'), // At least one required - now accepting coordinates as alternative

  coordinates: Joi.object({
    lat: Joi.number().min(18).max(72).required(), // US territory bounds
    lng: Joi.number().min(-180).max(-65).required(),
  }),
};

// Validation middleware factory
export function validate(schema: Joi.Schema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      throw new ValidationError(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    }

    // Replace request body with validated and sanitized data
    req.body = value;
    next();
  };
}

// Specific validators
export const validateLocationRequest = validate(schemas.validateLocation);

// Query parameter validation
export function validateQueryParams(schema: Joi.Schema) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));

      throw new ValidationError(
        `Invalid query parameters: ${errors.map(e => e.message).join(', ')}`
      );
    }

    req.query = value;
    next();
  };
}
