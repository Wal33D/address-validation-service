import { RequestDeduplicator } from '../../src/utils/RequestDeduplicator';

describe('RequestDeduplicator', () => {
  let deduplicator: RequestDeduplicator<string>;

  beforeEach(() => {
    deduplicator = new RequestDeduplicator(1000); // 1 second TTL
  });

  afterEach(() => {
    deduplicator.clear();
  });

  it('should return the same promise for concurrent identical requests', async () => {
    let callCount = 0;
    const testFn = async () => {
      callCount++;
      return new Promise<string>(resolve => {
        setTimeout(() => resolve('result'), 100);
      });
    };

    // Make 3 concurrent requests with the same key
    const promises = [
      deduplicator.execute('test-key', testFn),
      deduplicator.execute('test-key', testFn),
      deduplicator.execute('test-key', testFn),
    ];

    const results = await Promise.all(promises);

    // All should return the same result
    expect(results).toEqual(['result', 'result', 'result']);
    // But the function should only be called once
    expect(callCount).toBe(1);
  });

  it('should call function again for different keys', async () => {
    let callCount = 0;
    const testFn = async () => {
      callCount++;
      return `result-${callCount}`;
    };

    const result1 = await deduplicator.execute('key1', testFn);
    const result2 = await deduplicator.execute('key2', testFn);

    expect(result1).toBe('result-1');
    expect(result2).toBe('result-2');
    expect(callCount).toBe(2);
  });

  it('should call function again after TTL expires', async () => {
    let callCount = 0;
    const testFn = async () => {
      callCount++;
      return `result-${callCount}`;
    };

    // First call
    const result1 = await deduplicator.execute('test-key', testFn);
    expect(result1).toBe('result-1');
    expect(callCount).toBe(1);

    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Second call should execute again
    const result2 = await deduplicator.execute('test-key', testFn);
    expect(result2).toBe('result-2');
    expect(callCount).toBe(2);
  });

  it('should handle errors correctly', async () => {
    const testFn = async () => {
      throw new Error('Test error');
    };

    // Make concurrent requests
    const promises = [
      deduplicator.execute('error-key', testFn).catch(e => e.message),
      deduplicator.execute('error-key', testFn).catch(e => e.message),
    ];

    const results = await Promise.all(promises);

    // Both should receive the same error
    expect(results).toEqual(['Test error', 'Test error']);
  });

  it('should provide accurate stats', async () => {
    // Initial stats
    expect(deduplicator.getStats()).toEqual({
      pendingRequests: 0,
      ttl: 1000,
    });

    // Start a request
    const promise = deduplicator.execute(
      'test-key',
      () => new Promise(resolve => setTimeout(() => resolve('result'), 100))
    );

    // Check stats while pending
    expect(deduplicator.getStats().pendingRequests).toBe(1);

    await promise;

    // After completion (with small delay)
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(deduplicator.getStats().pendingRequests).toBe(0);
  });

  it('should clear all pending requests', async () => {
    const testFn = () => new Promise<string>(resolve => setTimeout(() => resolve('result'), 100));

    // Start multiple requests
    deduplicator.execute('key1', testFn);
    deduplicator.execute('key2', testFn);
    deduplicator.execute('key3', testFn);

    expect(deduplicator.getStats().pendingRequests).toBe(3);

    // Clear all
    deduplicator.clear();
    expect(deduplicator.getStats().pendingRequests).toBe(0);
  });
});
