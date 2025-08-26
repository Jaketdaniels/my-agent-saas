/**
 * Runtime-only Cloudflare module loader
 * These modules can only be imported in the Cloudflare Workers runtime
 * and will cause build errors if imported during Next.js build time
 */

// Type definitions for when the module is available
export type GetSandboxType = typeof import('@cloudflare/sandbox').getSandbox;
export type SandboxType = import('@cloudflare/sandbox').Sandbox;

/**
 * Dynamically loads the getSandbox function from @cloudflare/sandbox
 * This uses eval to completely bypass webpack's module analysis
 */
export async function loadGetSandbox(): Promise<GetSandboxType> {
  // Use eval to prevent webpack from analyzing this import
  // This will only work in the Cloudflare runtime where the module is available
  const sandboxModule = await eval('import("@cloudflare/sandbox")') as { getSandbox: GetSandboxType };
  return sandboxModule.getSandbox;
}

/**
 * Check if we're running in Cloudflare Workers runtime
 */
export function isCloudflareRuntime(): boolean {
  return typeof globalThis !== 'undefined' && 
         'caches' in globalThis && 
         typeof (globalThis as unknown as { WebSocketPair?: unknown }).WebSocketPair !== 'undefined';
}