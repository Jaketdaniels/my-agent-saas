import "server-only";

import { getKV } from "@/utils/kv-session";

export enum CircuitState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open"
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  halfOpenMaxAttempts?: number;
  monitoringPeriod?: number;
  volumeThreshold?: number;
}

export interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  nextRetryTime?: number;
  consecutiveSuccesses: number;
  totalRequests: number;
}

export class CircuitBreaker {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly halfOpenMaxAttempts: number;
  private readonly monitoringPeriod: number;
  private readonly volumeThreshold: number;

  constructor(name: string, options: CircuitBreakerOptions = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 3;
    this.timeout = options.timeout || 60000; // 60 seconds
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts || 3;
    this.monitoringPeriod = options.monitoringPeriod || 60000; // 60 seconds
    this.volumeThreshold = options.volumeThreshold || 10;
  }

  private getStateKey(): string {
    return `circuit:${this.name}:state`;
  }

  private getRequestsKey(): string {
    return `circuit:${this.name}:requests`;
  }

  /**
   * Get the current circuit breaker state from KV
   */
  private async getState(): Promise<CircuitBreakerState> {
    try {
      const kv = await getKV();
      const stateStr = await kv.get(this.getStateKey());
      
      if (!stateStr) {
        return {
          state: CircuitState.CLOSED,
          failures: 0,
          successes: 0,
          consecutiveSuccesses: 0,
          totalRequests: 0
        };
      }
      
      return JSON.parse(stateStr);
    } catch (error) {
      console.error(`[CircuitBreaker ${this.name}] Failed to get state:`, error);
      // Return closed state as fallback
      return {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        consecutiveSuccesses: 0,
        totalRequests: 0
      };
    }
  }

  /**
   * Update the circuit breaker state in KV
   */
  private async setState(state: CircuitBreakerState): Promise<void> {
    try {
      const kv = await getKV();
      await kv.put(this.getStateKey(), JSON.stringify(state), {
        expirationTtl: this.monitoringPeriod / 1000
      });
    } catch (error) {
      console.error(`[CircuitBreaker ${this.name}] Failed to set state:`, error);
    }
  }

  /**
   * Record a request for volume tracking
   */
  private async recordRequest(): Promise<number> {
    try {
      const kv = await getKV();
      const key = this.getRequestsKey();
      const currentCount = await kv.get(key);
      const count = currentCount ? parseInt(currentCount) + 1 : 1;
      
      await kv.put(key, count.toString(), {
        expirationTtl: this.monitoringPeriod / 1000
      });
      
      return count;
    } catch (error) {
      console.error(`[CircuitBreaker ${this.name}] Failed to record request:`, error);
      return 0;
    }
  }

  /**
   * Check if the circuit should transition from OPEN to HALF_OPEN
   */
  private shouldAttemptReset(state: CircuitBreakerState): boolean {
    if (state.state !== CircuitState.OPEN) {
      return false;
    }
    
    const now = Date.now();
    return state.nextRetryTime ? now >= state.nextRetryTime : false;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const state = await this.getState();
    const requestCount = await this.recordRequest();
    
    // Check if we have enough volume to make decisions
    if (requestCount < this.volumeThreshold && state.state === CircuitState.CLOSED) {
      // Not enough requests to trigger circuit breaker
      try {
        return await fn();
      } catch (error) {
        throw error;
      }
    }
    
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.shouldAttemptReset(state)) {
      state.state = CircuitState.HALF_OPEN;
      state.consecutiveSuccesses = 0;
      await this.setState(state);
    }
    
    // Handle based on current state
    switch (state.state) {
      case CircuitState.CLOSED:
        return this.executeInClosedState(fn, state);
      
      case CircuitState.OPEN:
        throw new Error(`Circuit breaker is OPEN for ${this.name}. Service is unavailable.`);
      
      case CircuitState.HALF_OPEN:
        return this.executeInHalfOpenState(fn, state);
      
      default:
        return this.executeInClosedState(fn, state);
    }
  }

  /**
   * Execute function when circuit is CLOSED
   */
  private async executeInClosedState<T>(
    fn: () => Promise<T>,
    state: CircuitBreakerState
  ): Promise<T> {
    try {
      const result = await fn();
      
      // Reset failures on success
      if (state.failures > 0) {
        state.failures = 0;
        state.successes++;
        state.totalRequests++;
        await this.setState(state);
      }
      
      return result;
    } catch (error) {
      state.failures++;
      state.lastFailureTime = Date.now();
      state.totalRequests++;
      
      // Check if we should open the circuit
      if (state.failures >= this.failureThreshold) {
        state.state = CircuitState.OPEN;
        state.nextRetryTime = Date.now() + this.timeout;
        console.log(`[CircuitBreaker ${this.name}] Opening circuit after ${state.failures} failures`);
      }
      
      await this.setState(state);
      throw error;
    }
  }

  /**
   * Execute function when circuit is HALF_OPEN
   */
  private async executeInHalfOpenState<T>(
    fn: () => Promise<T>,
    state: CircuitBreakerState
  ): Promise<T> {
    try {
      const result = await fn();
      
      state.consecutiveSuccesses++;
      state.successes++;
      state.totalRequests++;
      
      // Check if we should close the circuit
      if (state.consecutiveSuccesses >= this.successThreshold) {
        state.state = CircuitState.CLOSED;
        state.failures = 0;
        state.consecutiveSuccesses = 0;
        console.log(`[CircuitBreaker ${this.name}] Closing circuit after ${state.consecutiveSuccesses} consecutive successes`);
      }
      
      await this.setState(state);
      return result;
    } catch (error) {
      // Single failure in HALF_OPEN state reopens the circuit
      state.state = CircuitState.OPEN;
      state.failures++;
      state.consecutiveSuccesses = 0;
      state.lastFailureTime = Date.now();
      state.nextRetryTime = Date.now() + this.timeout;
      state.totalRequests++;
      
      console.log(`[CircuitBreaker ${this.name}] Reopening circuit after failure in HALF_OPEN state`);
      
      await this.setState(state);
      throw error;
    }
  }

  /**
   * Manually reset the circuit breaker
   */
  async reset(): Promise<void> {
    const state: CircuitBreakerState = {
      state: CircuitState.CLOSED,
      failures: 0,
      successes: 0,
      consecutiveSuccesses: 0,
      totalRequests: 0
    };
    
    await this.setState(state);
    console.log(`[CircuitBreaker ${this.name}] Circuit manually reset`);
  }

  /**
   * Manually open the circuit breaker
   */
  async trip(): Promise<void> {
    const state = await this.getState();
    state.state = CircuitState.OPEN;
    state.nextRetryTime = Date.now() + this.timeout;
    
    await this.setState(state);
    console.log(`[CircuitBreaker ${this.name}] Circuit manually tripped`);
  }

  /**
   * Get current circuit status
   */
  async getStatus(): Promise<{
    name: string;
    state: CircuitState;
    metrics: {
      failures: number;
      successes: number;
      totalRequests: number;
      failureRate: number;
      lastFailureTime?: Date;
      nextRetryTime?: Date;
    };
    config: {
      failureThreshold: number;
      successThreshold: number;
      timeout: number;
    };
  }> {
    const state = await this.getState();
    const failureRate = state.totalRequests > 0 
      ? state.failures / state.totalRequests 
      : 0;
    
    return {
      name: this.name,
      state: state.state,
      metrics: {
        failures: state.failures,
        successes: state.successes,
        totalRequests: state.totalRequests,
        failureRate: Math.round(failureRate * 100) / 100,
        lastFailureTime: state.lastFailureTime ? new Date(state.lastFailureTime) : undefined,
        nextRetryTime: state.nextRetryTime ? new Date(state.nextRetryTime) : undefined
      },
      config: {
        failureThreshold: this.failureThreshold,
        successThreshold: this.successThreshold,
        timeout: this.timeout
      }
    };
  }
}

/**
 * Factory function to create circuit breakers with default options
 */
export function createCircuitBreaker(
  name: string,
  options?: CircuitBreakerOptions
): CircuitBreaker {
  return new CircuitBreaker(name, options);
}

/**
 * Global circuit breaker registry
 */
const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(
  name: string,
  options?: CircuitBreakerOptions
): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, options));
  }
  return circuitBreakers.get(name)!;
}

/**
 * Decorator for adding circuit breaker protection to functions
 */
export function withCircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>>(
  name: string,
  options?: CircuitBreakerOptions
): (target: T) => T {
  return (target: T): T => {
    const breaker = getCircuitBreaker(name, options);
    
    return (async (...args: Parameters<T>) => {
      return breaker.execute(() => target(...args));
    }) as T;
  };
}