/**
 * Enhanced API client with silent retry philosophy
 */

import { withRetry, RetryOptions, retryableFetch } from '@/lib/utils/retry';

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
  async get<T = any>(
    path: string, 
    options?: RequestInit & { retry?: RetryOptions }
  ): Promise<T> {
    return this.request<T>('GET', path, undefined, options);
  }

  /**
   * Make a POST request with automatic retry
   */
  async post<T = any>(
    path: string,
    body?: any,
    options?: RequestInit & { retry?: RetryOptions }
  ): Promise<T> {
    return this.request<T>('POST', path, body, options);
  }

  /**
   * Make a PUT request with automatic retry
   */
  async put<T = any>(
    path: string,
    body?: any,
    options?: RequestInit & { retry?: RetryOptions }
  ): Promise<T> {
    return this.request<T>('PUT', path, body, options);
  }

  /**
   * Make a DELETE request with automatic retry
   */
  async delete<T = any>(
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
    body?: any,
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
              (errorBody as any).message : null) || 
            `HTTP ${response.status}: ${response.statusText}`;
          
          const error: any = new Error(errorMessage);
          error.status = response.status;
          error.body = errorBody;
          
          throw error;
        }

        // Parse successful response
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          return await response.json();
        }
        
        return response as any;
      },
      {
        ...retryOptions,
        shouldRetry: (error, attempt) => {
          // Don't retry on authentication errors
          if (error.status === 401 || error.status === 403) {
            return false;
          }

          // Don't retry on client errors except rate limiting
          if (error.status >= 400 && error.status < 500 && error.status !== 429) {
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
            { url, method, error: error.message }
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

// Export retryable fetch for direct use
export { retryableFetch } from '@/lib/utils/retry';