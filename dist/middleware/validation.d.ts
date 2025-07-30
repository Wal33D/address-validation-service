import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
export declare const schemas: {
    validateLocation: Joi.ObjectSchema<any>;
    coordinates: Joi.ObjectSchema<any>;
};
export declare function validate(schema: Joi.Schema): (req: Request, _res: Response, next: NextFunction) => void;
export declare const validateLocationRequest: (req: Request, _res: Response, next: NextFunction) => void;
export declare function validateQueryParams(schema: Joi.Schema): (req: Request, _res: Response, next: NextFunction) => void;
//# sourceMappingURL=validation.d.ts.map