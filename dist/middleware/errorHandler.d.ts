import { Request, Response, NextFunction } from 'express';
export declare function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void;
export declare function asyncHandler(fn: Function): (req: Request, res: Response, next: NextFunction) => void;
export declare function notFoundHandler(_req: Request, res: Response): void;
//# sourceMappingURL=errorHandler.d.ts.map