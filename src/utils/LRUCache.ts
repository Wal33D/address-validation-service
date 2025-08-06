interface CacheNode<K, V> {
  key: K;
  value: V;
  prev: CacheNode<K, V> | null;
  next: CacheNode<K, V> | null;
  timestamp: number;
}

export class LRUCache<K, V> {
  private capacity: number;
  private cache: Map<K, CacheNode<K, V>>;
  private head: CacheNode<K, V> | null;
  private tail: CacheNode<K, V> | null;
  private ttl: number; // Time to live in milliseconds

  constructor(capacity: number = 100, ttlSeconds: number = 3600) {
    this.capacity = capacity;
    this.cache = new Map();
    this.head = null;
    this.tail = null;
    this.ttl = ttlSeconds * 1000;
  }

  private removeNode(node: CacheNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private addToHead(node: CacheNode<K, V>): void {
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

  private isExpired(node: CacheNode<K, V>): boolean {
    return Date.now() - node.timestamp > this.ttl;
  }

  get(key: K): V | undefined {
    const node = this.cache.get(key);

    if (!node) {
      return undefined;
    }

    // Check if expired
    if (this.isExpired(node)) {
      this.removeNode(node);
      this.cache.delete(key);
      return undefined;
    }

    // Move to head (most recently used)
    this.removeNode(node);
    this.addToHead(node);

    return node.value;
  }

  set(key: K, value: V): void {
    const existingNode = this.cache.get(key);

    if (existingNode) {
      // Update existing node
      existingNode.value = value;
      existingNode.timestamp = Date.now();
      this.removeNode(existingNode);
      this.addToHead(existingNode);
    } else {
      // Create new node
      const newNode: CacheNode<K, V> = {
        key,
        value,
        prev: null,
        next: null,
        timestamp: Date.now(),
      };

      this.cache.set(key, newNode);
      this.addToHead(newNode);

      // Check capacity
      if (this.cache.size > this.capacity) {
        // Remove least recently used
        if (this.tail) {
          this.cache.delete(this.tail.key);
          this.removeNode(this.tail);
        }
      }
    }
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  size(): number {
    return this.cache.size;
  }

  // Get cache statistics
  getStats(): {
    size: number;
    capacity: number;
    utilization: number;
  } {
    return {
      size: this.cache.size,
      capacity: this.capacity,
      utilization: (this.cache.size / this.capacity) * 100,
    };
  }

  // Clean up expired entries
  cleanExpired(): number {
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

// Geocoding cache key generator
export function generateGeocacheKey(params: {
  address?: string;
  lat?: number;
  lng?: number;
}): string {
  if (params.address) {
    return `addr:${params.address.toLowerCase().replace(/\s+/g, ' ').trim()}`;
  }
  if (params.lat !== undefined && params.lng !== undefined) {
    // Round to 5 decimal places for cache key
    return `coord:${params.lat.toFixed(5)},${params.lng.toFixed(5)}`;
  }
  throw new Error('Invalid cache key parameters');
}
