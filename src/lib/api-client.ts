/**
 * Enhanced API client with silent retry philosophy
 */

import { withRetry, RetryOptions } from '@/lib/utils/retry';

export interface ApiClientOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
  retryOptions?: RetryOptions;
}

export class ApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private retryOptions: RetryOptions;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl || '';
    this.headers = options.headers || {};
    this.retryOptions = options.retryOptions || {
      maxRetries: 3,
      initialDelayMs: 100,
      maxDelayMs: 900
    };
  }

  /**
   * Make a GET request with automatic retry
   */
  async get<T = unknown>(
    path: string, 
    options?: RequestInit & { retry?: RetryOptions }
  ): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * Make a POST request with automatic retry
   */
  async post<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestInit & { retry?: RetryOptions }
  ): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  /**
   * Make a PUT request with automatic retry
   */
  async put<T = unknown>(
    path: string,
    body?: unknown,
    options?: RequestInit & { retry?: RetryOptions }
  ): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  /**
   * Make a DELETE request with automatic retry
   */
  async delete<T = unknown>(
    path: string,
    options?: RequestInit & { retry?: RetryOptions }
  ): Promise<T> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  /**
   * Make a request with automatic retry on failure
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: RequestInit & { retry?: RetryOptions } = {}
  ): Promise<T> {
    const { retry, ...fetchOptions } = options;
    const retryOptions = { ...this.retryOptions, ...retry };

    const url = this.baseUrl ? `${this.baseUrl}${path}` : path;

    return withRetry(
      async () => {
        const response = await fetch(url, {
          ...fetchOptions,
          method,
          headers: {
            'Content-Type': 'application/json',
            ...this.headers,
            ...fetchOptions.headers
          },
          body: body ? JSON.stringify(body) : undefined
        });

        // Handle non-OK responses
        if (!response.ok) {
          // Parse error body if possible
          let errorBody;
          try {
            errorBody = await response.json();
          } catch {
            errorBody = await response.text();
          }

          const errorMessage = 
            (typeof errorBody === 'object' && errorBody && 'message' in errorBody ? 
              String((errorBody as Record<string, unknown>).message) : null) || 
            `HTTP ${response.status}: ${response.statusText}`;
          
          const error = new Error(errorMessage) as Error & { status: number; body: unknown };
          error.status = response.status;
          error.body = errorBody;
          
          throw error;
        }

        // Parse successful response
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await response.json();
        }
        
        return response as T;
      },
      {
        ...retryOptions,
        shouldRetry: (error, attempt) => {
          // Don't retry on authentication errors
          const err = error as { status?: number };
          if (err.status === 401 || err.status === 403) {
            return false;
          }

          // Don't retry on client errors except rate limiting
          if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
            return false;
          }

          // Use custom shouldRetry if provided
          if (retryOptions.shouldRetry) {
            return retryOptions.shouldRetry(error, attempt);
          }

          // Retry on network and server errors
          return true;
        },
        onRetry: (error, attempt) => {
          console.log(
            `[API Client] Request failed (attempt ${attempt}/${retryOptions.maxRetries}):`,
            { url, method, error: error instanceof Error ? error.message : String(error) }
          );
          
          // Call custom onRetry if provided
          retryOptions.onRetry?.(error, attempt);
        }
      }
    );
  }
}

// Export singleton instance for convenience
export const apiClient = new ApiClient({
  headers: {
    'x-client-version': '1.0.0'
  }
});