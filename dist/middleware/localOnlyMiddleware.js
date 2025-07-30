"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localOnlyMiddleware = localOnlyMiddleware;
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
//# sourceMappingURL=localOnlyMiddleware.js.map