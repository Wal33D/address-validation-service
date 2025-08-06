import logger from './logger';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening
  resetTimeout: number; // Time to wait before trying again (ms)
  monitoringPeriod: number; // Time window for counting failures (ms)
  successThreshold?: number; // Successes needed to close from half-open
}

interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime: number | undefined;
  lastStateChange: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: number;
  private lastStateChange = Date.now();
  private totalRequests = 0;
  private totalFailures = 0;
  private totalSuccesses = 0;
  private failureTimestamps: number[] = [];

  constructor(
    private name: string,
    private options: CircuitBreakerOptions
  ) {
    this.options.successThreshold = options.successThreshold || 2;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        error.name = 'CircuitBreakerOpenError';
        throw error;
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.totalSuccesses++;
    this.successes++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.options.successThreshold!) {
        this.transitionToClosed();
      }
    }

    // Reset failure count on success in closed state
    if (this.state === CircuitState.CLOSED) {
      this.failures = 0;
      this.failureTimestamps = [];
    }
  }

  private onFailure(): void {
    this.totalFailures++;
    this.failures++;
    this.lastFailureTime = Date.now();
    this.failureTimestamps.push(Date.now());

    // Clean old timestamps outside monitoring period
    const cutoff = Date.now() - this.options.monitoringPeriod;
    this.failureTimestamps = this.failureTimestamps.filter(ts => ts > cutoff);

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
    } else if (this.state === CircuitState.CLOSED) {
      // Count recent failures within monitoring period
      if (this.failureTimestamps.length >= this.options.failureThreshold) {
        this.transitionToOpen();
      }
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime !== undefined &&
      Date.now() - this.lastFailureTime >= this.options.resetTimeout
    );
  }

  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.lastStateChange = Date.now();
    this.successes = 0;
    logger.warn(`Circuit breaker opened for ${this.name}`, {
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    });
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.lastStateChange = Date.now();
    this.successes = 0;
    this.failures = 0;
    logger.info(`Circuit breaker half-open for ${this.name}`);
  }

  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.lastStateChange = Date.now();
    this.failures = 0;
    this.successes = 0;
    this.failureTimestamps = [];
    logger.info(`Circuit breaker closed for ${this.name}`);
  }

  getStats(): CircuitStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    delete this.lastFailureTime;
    this.lastStateChange = Date.now();
    this.failureTimestamps = [];
    logger.info(`Circuit breaker manually reset for ${this.name}`);
  }
}

// Create circuit breakers for external services
export const uspsCircuitBreaker = new CircuitBreaker('USPS API', {
  failureThreshold: 5, // Open after 5 failures
  resetTimeout: 30000, // Try again after 30 seconds
  monitoringPeriod: 60000, // Count failures in 1 minute window
  successThreshold: 3, // Need 3 successes to close from half-open
});

export const googleMapsCircuitBreaker = new CircuitBreaker('Google Maps API', {
  failureThreshold: 5,
  resetTimeout: 30000,
  monitoringPeriod: 60000,
  successThreshold: 3,
});
