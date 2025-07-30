import { createHash } from 'crypto';
import logger from './logger';

interface PendingRequest<T> {
    promise: Promise<T>;
    timestamp: number;
}

export class RequestDeduplicator<T = any> {
    private pendingRequests: Map<string, PendingRequest<T>> = new Map();
    private readonly ttl: number;

    constructor(ttl: number = 5000) { // Default 5 seconds TTL
        this.ttl = ttl;
        // Clean up expired pending requests periodically
        setInterval(() => this.cleanupExpired(), this.ttl);
    }

    /**
     * Execute a request with deduplication
     * @param key - Unique key for the request
     * @param requestFn - Function that returns a promise
     * @returns Promise with the result
     */
    async execute(key: string, requestFn: () => Promise<T>): Promise<T> {
        const requestKey = this.hashKey(key);
        
        // Check if we have a pending request for this key
        const pending = this.pendingRequests.get(requestKey);
        if (pending && Date.now() - pending.timestamp < this.ttl) {
            logger.debug(`Deduplicating request for key: ${key}`);
            return pending.promise;
        }

        // Create new request
        const promise = requestFn().finally(() => {
            // Remove from pending after completion
            setTimeout(() => {
                this.pendingRequests.delete(requestKey);
            }, 100); // Small delay to handle near-simultaneous requests
        });

        // Store the pending request
        this.pendingRequests.set(requestKey, {
            promise,
            timestamp: Date.now()
        });

        return promise;
    }

    /**
     * Create a hash key from the input
     */
    private hashKey(key: string): string {
        return createHash('sha256').update(key).digest('hex');
    }

    /**
     * Clean up expired pending requests
     */
    private cleanupExpired(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, pending] of this.pendingRequests.entries()) {
            if (now - pending.timestamp > this.ttl) {
                this.pendingRequests.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            logger.debug(`Cleaned up ${cleaned} expired pending requests`);
        }
    }

    /**
     * Get current stats
     */
    getStats() {
        return {
            pendingRequests: this.pendingRequests.size,
            ttl: this.ttl
        };
    }

    /**
     * Clear all pending requests
     */
    clear(): void {
        this.pendingRequests.clear();
    }
}

// Singleton instances for different types of requests
export const uspsDeduplicator = new RequestDeduplicator(5000); // 5 seconds
export const googleMapsDeduplicator = new RequestDeduplicator(5000); // 5 seconds