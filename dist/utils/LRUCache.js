"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LRUCache = void 0;
exports.generateGeocacheKey = generateGeocacheKey;
class LRUCache {
    capacity;
    cache;
    head;
    tail;
    ttl;
    constructor(capacity = 100, ttlSeconds = 3600) {
        this.capacity = capacity;
        this.cache = new Map();
        this.head = null;
        this.tail = null;
        this.ttl = ttlSeconds * 1000;
    }
    removeNode(node) {
        if (node.prev) {
            node.prev.next = node.next;
        }
        else {
            this.head = node.next;
        }
        if (node.next) {
            node.next.prev = node.prev;
        }
        else {
            this.tail = node.prev;
        }
    }
    addToHead(node) {
        node.next = this.head;
        node.prev = null;
        if (this.head) {
            this.head.prev = node;
        }
        this.head = node;
        if (!this.tail) {
            this.tail = node;
        }
    }
    isExpired(node) {
        return Date.now() - node.timestamp > this.ttl;
    }
    get(key) {
        const node = this.cache.get(key);
        if (!node) {
            return undefined;
        }
        if (this.isExpired(node)) {
            this.removeNode(node);
            this.cache.delete(key);
            return undefined;
        }
        this.removeNode(node);
        this.addToHead(node);
        return node.value;
    }
    set(key, value) {
        const existingNode = this.cache.get(key);
        if (existingNode) {
            existingNode.value = value;
            existingNode.timestamp = Date.now();
            this.removeNode(existingNode);
            this.addToHead(existingNode);
        }
        else {
            const newNode = {
                key,
                value,
                prev: null,
                next: null,
                timestamp: Date.now()
            };
            this.cache.set(key, newNode);
            this.addToHead(newNode);
            if (this.cache.size > this.capacity) {
                if (this.tail) {
                    this.cache.delete(this.tail.key);
                    this.removeNode(this.tail);
                }
            }
        }
    }
    clear() {
        this.cache.clear();
        this.head = null;
        this.tail = null;
    }
    size() {
        return this.cache.size;
    }
    getStats() {
        return {
            size: this.cache.size,
            capacity: this.capacity,
            utilization: (this.cache.size / this.capacity) * 100
        };
    }
    cleanExpired() {
        let removed = 0;
        const now = Date.now();
        for (const [key, node] of this.cache.entries()) {
            if (now - node.timestamp > this.ttl) {
                this.removeNode(node);
                this.cache.delete(key);
                removed++;
            }
        }
        return removed;
    }
}
exports.LRUCache = LRUCache;
function generateGeocacheKey(params) {
    if (params.address) {
        return `addr:${params.address.toLowerCase().replace(/\s+/g, ' ').trim()}`;
    }
    if (params.lat !== undefined && params.lng !== undefined) {
        return `coord:${params.lat.toFixed(5)},${params.lng.toFixed(5)}`;
    }
    throw new Error('Invalid cache key parameters');
}
//# sourceMappingURL=LRUCache.js.map