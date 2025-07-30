import { LRUCache, generateGeocacheKey } from '../../utils/LRUCache';

describe('LRUCache', () => {
    let cache: LRUCache<string, string>;

    beforeEach(() => {
        cache = new LRUCache<string, string>(3, 1); // capacity 3, TTL 1 second
    });

    describe('basic operations', () => {
        it('should store and retrieve values', () => {
            cache.set('key1', 'value1');
            expect(cache.get('key1')).toBe('value1');
        });

        it('should return undefined for non-existent keys', () => {
            expect(cache.get('nonexistent')).toBeUndefined();
        });

        it('should update existing values', () => {
            cache.set('key1', 'value1');
            cache.set('key1', 'updated');
            expect(cache.get('key1')).toBe('updated');
        });

        it('should evict least recently used item when capacity exceeded', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');
            cache.set('key4', 'value4'); // Should evict key1

            expect(cache.get('key1')).toBeUndefined();
            expect(cache.get('key2')).toBe('value2');
            expect(cache.get('key3')).toBe('value3');
            expect(cache.get('key4')).toBe('value4');
        });

        it('should move accessed items to head', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            cache.set('key3', 'value3');
            
            // Access key1, moving it to head
            cache.get('key1');
            
            // Add key4, should evict key2 (least recently used)
            cache.set('key4', 'value4');

            expect(cache.get('key1')).toBe('value1');
            expect(cache.get('key2')).toBeUndefined();
            expect(cache.get('key3')).toBe('value3');
            expect(cache.get('key4')).toBe('value4');
        });
    });

    describe('TTL functionality', () => {
        it('should expire items after TTL', async () => {
            cache.set('key1', 'value1');
            expect(cache.get('key1')).toBe('value1');

            // Wait for TTL to expire
            await new Promise(resolve => setTimeout(resolve, 1100));

            expect(cache.get('key1')).toBeUndefined();
        });

        it('should clean expired entries', async () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            
            await new Promise(resolve => setTimeout(resolve, 1100));
            
            const removed = cache.cleanExpired();
            expect(removed).toBe(2);
            expect(cache.size()).toBe(0);
        });
    });

    describe('utility methods', () => {
        it('should clear all entries', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            
            cache.clear();
            
            expect(cache.size()).toBe(0);
            expect(cache.get('key1')).toBeUndefined();
            expect(cache.get('key2')).toBeUndefined();
        });

        it('should return correct stats', () => {
            cache.set('key1', 'value1');
            cache.set('key2', 'value2');
            
            const stats = cache.getStats();
            
            expect(stats.size).toBe(2);
            expect(stats.capacity).toBe(3);
            expect(stats.utilization).toBeCloseTo(66.67, 1);
        });
    });
});

describe('generateGeocacheKey', () => {
    it('should generate key for address', () => {
        const key = generateGeocacheKey({ address: '  123 Main St  ' });
        expect(key).toBe('addr:123 main st');
    });

    it('should generate key for coordinates', () => {
        const key = generateGeocacheKey({ lat: 40.7128123, lng: -74.0060456 });
        expect(key).toBe('coord:40.71281,-74.00605');
    });

    it('should throw error for invalid parameters', () => {
        expect(() => generateGeocacheKey({})).toThrow('Invalid cache key parameters');
    });

    it('should prioritize address over coordinates', () => {
        const key = generateGeocacheKey({ 
            address: '123 Main St',
            lat: 40.7128,
            lng: -74.0060
        });
        expect(key).toBe('addr:123 main st');
    });
});