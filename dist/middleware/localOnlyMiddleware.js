"use strict";
// src/middleware/localOnlyMiddleware.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.localOnlyMiddleware = localOnlyMiddleware;
/**
 * Middleware that only allows requests coming from the local machine.
 * It checks that the incoming IP is either "127.0.0.1" or "::1". If not,
 * the middleware responds with a 403 Forbidden error.
 */
function localOnlyMiddleware(req, res, next) {
    const clientIp = (req.ip || '').replace(/^::ffff:/, '');
    const allowedIPs = ['127.0.0.1', '::1'];
    if (allowedIPs.includes(clientIp)) {
        next();
    }
    else {
        res.status(403).json({ error: 'Access denied: Only local requests are allowed' });
    }
}
