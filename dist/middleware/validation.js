"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateLocationRequest = exports.schemas = void 0;
exports.validate = validate;
exports.validateQueryParams = validateQueryParams;
const joi_1 = __importDefault(require("joi"));
const errors_1 = require("../utils/errors");
exports.schemas = {
    validateLocation: joi_1.default.object({
        streetAddress: joi_1.default.string().min(1).max(200).required(),
        city: joi_1.default.string().min(1).max(100),
        state: joi_1.default.string().length(2).uppercase(),
        zipCode: joi_1.default.string().pattern(/^\d{5}(-\d{4})?$/),
        geo: joi_1.default.object({
            type: joi_1.default.string().valid('Point').required(),
            coordinates: joi_1.default.array().items(joi_1.default.number()).length(2).required()
        }),
        formattedAddress: joi_1.default.string().max(500),
        county: joi_1.default.string().max(100),
        unformattedAddress: joi_1.default.string().max(500),
        latitude: joi_1.default.number().min(-90).max(90),
        longitude: joi_1.default.number().min(-180).max(180)
    }).or('city', 'zipCode'),
    coordinates: joi_1.default.object({
        lat: joi_1.default.number().min(18).max(72).required(),
        lng: joi_1.default.number().min(-180).max(-65).required()
    })
};
function validate(schema) {
    return (req, _res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });
        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            throw new errors_1.ValidationError(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
        }
        req.body = value;
        next();
    };
}
exports.validateLocationRequest = validate(exports.schemas.validateLocation);
function validateQueryParams(schema) {
    return (req, _res, next) => {
        const { error, value } = schema.validate(req.query, {
            abortEarly: false
        });
        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            throw new errors_1.ValidationError(`Invalid query parameters: ${errors.map(e => e.message).join(', ')}`);
        }
        req.query = value;
        next();
    };
}
//# sourceMappingURL=validation.js.map