"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stream = void 0;
const winston_1 = __importDefault(require("winston"));
const path_1 = __importDefault(require("path"));
const { combine, timestamp, printf, colorize, errors } = winston_1.default.format;
const logFormat = printf(({ level, message, timestamp, stack, ...metadata }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        log += ` ${JSON.stringify(metadata)}`;
    }
    if (stack) {
        log += `\n${stack}`;
    }
    return log;
});
const logger = winston_1.default.createLogger({
    level: process.env['LOG_LEVEL'] || 'info',
    format: combine(errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat),
    transports: [
        new winston_1.default.transports.Console({
            format: combine(colorize(), errors({ stack: true }), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), logFormat)
        })
    ]
});
if (process.env['NODE_ENV'] === 'production') {
    logger.add(new winston_1.default.transports.File({
        filename: path_1.default.join('logs', 'error.log'),
        level: 'error',
        maxsize: 5242880,
        maxFiles: 5
    }));
    logger.add(new winston_1.default.transports.File({
        filename: path_1.default.join('logs', 'combined.log'),
        maxsize: 5242880,
        maxFiles: 5
    }));
}
exports.stream = {
    write: (message) => {
        logger.info(message.trim());
    }
};
exports.default = logger;
//# sourceMappingURL=logger.js.map