import { CircuitBreaker, CircuitState } from '../../utils/CircuitBreaker';

describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
        circuitBreaker = new CircuitBreaker('Test Service', {
            failureThreshold: 3,
            resetTimeout: 1000, // 1 second
            monitoringPeriod: 5000, // 5 seconds
            successThreshold: 2
        });
    });

    describe('Initial State', () => {
        it('should start in CLOSED state', () => {
            const stats = circuitBreaker.getStats();
            expect(stats.state).toBe(CircuitState.CLOSED);
            expect(stats.failures).toBe(0);
            expect(stats.successes).toBe(0);
        });
    });

    describe('Failure Handling', () => {
        it('should remain CLOSED on failures below threshold', async () => {
            const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

            // First failure
            await expect(circuitBreaker.execute(failingFn)).rejects.toThrow('Test error');
            expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);

            // Second failure
            await expect(circuitBreaker.execute(failingFn)).rejects.toThrow('Test error');
            expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
        });

        it('should transition to OPEN after reaching failure threshold', async () => {
            const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

            // Fail 3 times to reach threshold
            for (let i = 0; i < 3; i++) {
                await expect(circuitBreaker.execute(failingFn)).rejects.toThrow('Test error');
            }

            expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
            expect(failingFn).toHaveBeenCalledTimes(3);
        });

        it('should reject calls immediately when OPEN', async () => {
            const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

            // Open the circuit
            for (let i = 0; i < 3; i++) {
                await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
            }

            // Next call should be rejected without executing the function
            await expect(circuitBreaker.execute(failingFn)).rejects.toThrow('Circuit breaker is OPEN');
            expect(failingFn).toHaveBeenCalledTimes(3); // Still 3, not 4
        });
    });

    describe('Recovery', () => {
        it('should transition to HALF_OPEN after reset timeout', async () => {
            const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));
            const successFn = jest.fn().mockResolvedValue('success');

            // Open the circuit
            for (let i = 0; i < 3; i++) {
                await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
            }

            expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);

            // Wait for reset timeout
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Next call should attempt (HALF_OPEN state)
            const result = await circuitBreaker.execute(successFn);
            expect(result).toBe('success');
            expect(circuitBreaker.getStats().state).toBe(CircuitState.HALF_OPEN);
        });

        it('should transition to CLOSED after success threshold in HALF_OPEN', async () => {
            const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));
            const successFn = jest.fn().mockResolvedValue('success');

            // Open the circuit
            for (let i = 0; i < 3; i++) {
                await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
            }

            // Wait for reset timeout
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Two successful calls to meet threshold
            await circuitBreaker.execute(successFn);
            expect(circuitBreaker.getStats().state).toBe(CircuitState.HALF_OPEN);

            await circuitBreaker.execute(successFn);
            expect(circuitBreaker.getStats().state).toBe(CircuitState.CLOSED);
        });

        it('should return to OPEN on failure in HALF_OPEN state', async () => {
            const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

            // Open the circuit
            for (let i = 0; i < 3; i++) {
                await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
            }

            // Wait for reset timeout
            await new Promise(resolve => setTimeout(resolve, 1100));

            // Fail again in HALF_OPEN state
            await expect(circuitBreaker.execute(failingFn)).rejects.toThrow('Test error');
            expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);
        });
    });

    describe('Monitoring Period', () => {
        it('should only count failures within monitoring period', async () => {
            // Create a circuit breaker with shorter monitoring period for testing
            const testBreaker = new CircuitBreaker('Test Service', {
                failureThreshold: 3,
                resetTimeout: 1000,
                monitoringPeriod: 1000, // 1 second for faster testing
                successThreshold: 2
            });

            const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

            // Two failures
            await expect(testBreaker.execute(failingFn)).rejects.toThrow();
            await expect(testBreaker.execute(failingFn)).rejects.toThrow();

            // Wait longer than monitoring period
            await new Promise(resolve => setTimeout(resolve, 1100));

            // This failure should not trigger open state (old failures expired)
            await expect(testBreaker.execute(failingFn)).rejects.toThrow();
            expect(testBreaker.getStats().state).toBe(CircuitState.CLOSED);
        }, 10000); // Increase test timeout
    });

    describe('Statistics', () => {
        it('should track total requests and outcomes', async () => {
            const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));
            const successFn = jest.fn().mockResolvedValue('success');

            await circuitBreaker.execute(successFn);
            await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
            await circuitBreaker.execute(successFn);

            const stats = circuitBreaker.getStats();
            expect(stats.totalRequests).toBe(3);
            expect(stats.totalSuccesses).toBe(2);
            expect(stats.totalFailures).toBe(1);
        });
    });

    describe('Manual Reset', () => {
        it('should reset circuit to CLOSED state', async () => {
            const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

            // Open the circuit
            for (let i = 0; i < 3; i++) {
                await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
            }

            expect(circuitBreaker.getStats().state).toBe(CircuitState.OPEN);

            // Manual reset
            circuitBreaker.reset();
            const stats = circuitBreaker.getStats();
            expect(stats.state).toBe(CircuitState.CLOSED);
            expect(stats.failures).toBe(0);
            expect(stats.successes).toBe(0);
        });
    });
});