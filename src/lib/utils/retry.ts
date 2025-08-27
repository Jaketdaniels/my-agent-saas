/**
 * Silent retry utilities for handling transient failures
 * Implements exponential backoff with jitter
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any, attempt: number) => boolean;
  onRetry?: (error: any, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'shouldRetry' | 'onRetry'>> = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  // Exponential backoff: delay = initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt - 1);
  
  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  
  // Add jitter (0-25% of delay) to prevent thundering herd
  const jitter = cappedDelay * Math.random() * 0.25;
  
  return Math.floor(cappedDelay + jitter);
}

/**
 * Default retry predicate - retry on network and transient errors
 */
function defaultShouldRetry(error: any): boolean {
  // Retry on network errors
  if (error.code === 'ECONNREFUSED' || 
      error.code === 'ETIMEDOUT' || 
      error.code === 'ENOTFOUND') {
    return true;
  }
  
  // Retry on specific HTTP status codes
  if (error.status === 429 || // Rate limited
      error.status === 502 || // Bad gateway
      error.status === 503 || // Service unavailable
      error.status === 504) { // Gateway timeout
    return true;
  }
  
  // Retry on fetch failures
  if (error.message?.includes('fetch failed') ||
      error.message?.includes('network')) {
    return true;
  }
  
  return false;
}

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const shouldRetry = opts.shouldRetry || defaultShouldRetry;
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt === opts.maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }
      
      // Calculate delay
      const delay = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier
      );
      
      // Call retry callback if provided
      opts.onRetry?.(error, attempt);
      
      // Log retry attempt (silent to user, visible in console)
      console.log(
        `[Retry] Attempt ${attempt}/${opts.maxRetries} failed, retrying in ${delay}ms:`,
        error instanceof Error ? error.message : String(error)
      );
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Retry a sync operation with exponential backoff
 */
export function withRetrySync<T>(
  fn: () => T,
  options: RetryOptions = {}
): T {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const shouldRetry = opts.shouldRetry || defaultShouldRetry;
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
    try {
      return fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt === opts.maxRetries || !shouldRetry(error, attempt)) {
        throw error;
      }
      
      // Calculate delay
      const delay = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier
      );
      
      // Call retry callback if provided
      opts.onRetry?.(error, attempt);
      
      // Log retry attempt
      console.log(
        `[Retry] Attempt ${attempt}/${opts.maxRetries} failed, retrying in ${delay}ms:`,
        error instanceof Error ? error.message : String(error)
      );
      
      // Synchronous wait (blocks - use sparingly!)
      const start = Date.now();
      while (Date.now() - start < delay) {
        // Busy wait
      }
    }
  }
  
  throw lastError;
}

/**
 * Create a retryable fetch function
 */
export function createRetryableFetch(defaultOptions?: RetryOptions) {
  return async function retryableFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
    retryOptions?: RetryOptions
  ): Promise<Response> {
    const options = { ...defaultOptions, ...retryOptions };
    
    return withRetry(
      async () => {
        const response = await fetch(input, init);
        
        // Throw on server errors to trigger retry
        if (response.status >= 500) {
          throw Object.assign(
            new Error(`HTTP ${response.status}: ${response.statusText}`),
            { status: response.status }
          );
        }
        
        return response;
      },
      {
        ...options,
        shouldRetry: (error, attempt) => {
          // Use custom shouldRetry if provided
          if (options.shouldRetry) {
            return options.shouldRetry(error, attempt);
          }
          
          // Don't retry on client errors (4xx)
          if (error.status >= 400 && error.status < 500) {
            return false;
          }
          
          return defaultShouldRetry(error);
        }
      }
    );
  };
}

/**
 * React hook for retryable operations
 */
export function useRetryableOperation<T>(
  operation: () => Promise<T>,
  options?: RetryOptions
) {
  const executeWithRetry = async () => {
    return withRetry(operation, options);
  };
  
  return executeWithRetry;
}

// Export a pre-configured fetch with sensible defaults
export const retryableFetch = createRetryableFetch({
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000
});