/**
 * Cloudflare Environment Type Definitions
 * This extends the auto-generated cloudflare-env.d.ts with proper typing
 */

import type { DurableObjectNamespace } from '@cloudflare/workers-types';

// Import the auto-generated CloudflareEnv from the root
import type { CloudflareEnv as GeneratedCloudflareEnv } from '../../cloudflare-env.d.ts';

// Re-export the generated type for use in the app
export type CloudflareEnv = GeneratedCloudflareEnv;

// Additional helper types for Cloudflare-specific features
export interface CloudflareRequestContext {
  env: CloudflareEnv;
  cf: IncomingRequestCfProperties;
  ctx: ExecutionContext;
}

// Durable Object binding type helpers
export type SandboxNamespace = DurableObjectNamespace;

// KV Namespace type helpers  
export type KVNamespace = KVNamespace;

// D1 Database type helpers
export type D1Database = D1Database;

// Request context helper for Next.js routes
export interface NextCloudflareContext {
  request: Request;
  env: CloudflareEnv;
  params?: Record<string, string>;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
}

// Session types for agent interactions
export interface AgentSession {
  id: string;
  userId: string;
  createdAt: number;
  lastActivity: number;
  metadata?: Record<string, unknown>;
}

// User context for agent operations
export interface AgentUserContext {
  userId: string;
  sessionId: string;
  credits?: number;
  limits?: {
    maxExecutionTime?: number;
    maxFileSize?: number;
    maxProcesses?: number;
  };
}