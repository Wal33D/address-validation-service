export declare class LRUCache<K, V> {
    private capacity;
    private cache;
    private head;
    private tail;
    private ttl;
    constructor(capacity?: number, ttlSeconds?: number);
    private removeNode;
    private addToHead;
    private isExpired;
    get(key: K): V | undefined;
    set(key: K, value: V): void;
    clear(): void;
    size(): number;
    getStats(): {
        size: number;
        capacity: number;
        utilization: number;
    };
    cleanExpired(): number;
}
export declare function generateGeocacheKey(params: {
    address?: string;
    lat?: number;
    lng?: number;
}): string;
//# sourceMappingURL=LRUCache.d.ts.map