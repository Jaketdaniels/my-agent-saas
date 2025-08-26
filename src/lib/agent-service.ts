/**
 * Agent Service Layer
 * Provides a clean interface for interacting with the Cloudflare Sandbox
 * from Next.js route handlers
 */

import { getSandbox, type ISandbox } from '@cloudflare/sandbox';
import type { CloudflareEnv } from '@/types/cloudflare';

// Generate secure random session ID
export function generateSessionId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Get or create a sandbox instance for a user
export function getUserSandbox(
  env: CloudflareEnv,
  userId: string,
  sessionId?: string
): ISandbox {
  // Use a consistent ID for the user's sandbox instance
  // This ensures the same sandbox is reused across requests
  const sandboxId = sessionId || `user-${userId}-sandbox`;
  return getSandbox(env.Sandbox as any, sandboxId);
}

// Helper to safely parse JSON from request
export async function parseRequestBody<T = any>(request: Request): Promise<T> {
  try {
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await request.json();
    }
    return {} as T;
  } catch {
    return {} as T;
  }
}

// Helper to create consistent API responses
export function createApiResponse<T = any>(
  data: T,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

// Helper to create error responses
export function createErrorResponse(
  message: string,
  status: number = 400,
  details?: any
): Response {
  return createApiResponse(
    {
      error: message,
      ...(details && { details }),
    },
    status
  );
}

// Helper to create streaming response for SSE
export function createStreamResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Type guards for Sandbox responses
export function isSandboxError(response: any): response is Error {
  return response instanceof Error || 
         (typeof response === 'object' && response !== null && 'error' in response);
}

// Wrapper for sandbox operations with error handling
export async function withSandbox<T>(
  operation: (sandbox: ISandbox) => Promise<T>,
  sandbox: ISandbox,
  errorMessage: string = 'Sandbox operation failed'
): Promise<T> {
  try {
    return await operation(sandbox);
  } catch (error) {
    console.error(`Sandbox Error: ${errorMessage}`, error);
    if (error instanceof Error) {
      throw new Error(`${errorMessage}: ${error.message}`);
    }
    throw new Error(errorMessage);
  }
}

// Common sandbox operations
export class SandboxOperations {
  constructor(private sandbox: ISandbox) {}

  async executeCommand(command: string, options?: any) {
    return withSandbox(
      async (sb) => sb.exec(command, options),
      this.sandbox,
      'Failed to execute command'
    );
  }

  async readFile(path: string, encoding?: string) {
    return withSandbox(
      async (sb) => sb.readFile(path, { encoding }),
      this.sandbox,
      'Failed to read file'
    );
  }

  async writeFile(path: string, content: string, options?: any) {
    return withSandbox(
      async (sb) => sb.writeFile(path, content, options),
      this.sandbox,
      'Failed to write file'
    );
  }

  async listFiles(path?: string) {
    return withSandbox(
      async (sb) => sb.listFiles(path || '/'),
      this.sandbox,
      'Failed to list files'
    );
  }

  async deleteFile(path: string) {
    return withSandbox(
      async (sb) => sb.deleteFile(path),
      this.sandbox,
      'Failed to delete file'
    );
  }

  async createDirectory(path: string) {
    return withSandbox(
      async (sb) => sb.mkdir(path),
      this.sandbox,
      'Failed to create directory'
    );
  }

  async startProcess(command: string, args?: string[], options?: any) {
    return withSandbox(
      async (sb) => sb.startProcess(command, args, options),
      this.sandbox,
      'Failed to start process'
    );
  }

  async killProcess(processId: string) {
    return withSandbox(
      async (sb) => sb.killProcess(processId),
      this.sandbox,
      'Failed to kill process'
    );
  }

  async getProcesses() {
    return withSandbox(
      async (sb) => sb.getProcesses(),
      this.sandbox,
      'Failed to get processes'
    );
  }

  async exposePort(port: number, protocol?: 'http' | 'https') {
    return withSandbox(
      async (sb) => sb.exposePort(port, protocol),
      this.sandbox,
      'Failed to expose port'
    );
  }

  async unexposePort(port: number) {
    return withSandbox(
      async (sb) => sb.unexposePort(port),
      this.sandbox,
      'Failed to unexpose port'
    );
  }
}