export type GetSandboxType = typeof import('@cloudflare/sandbox').getSandbox;
export type SandboxType = import('@cloudflare/sandbox').Sandbox;

export async function loadGetSandbox(): Promise<GetSandboxType> {
  const sandboxModule = await (0, eval)('import("@cloudflare/sandbox")') as { getSandbox: GetSandboxType };
  return sandboxModule.getSandbox;
}

export function isCloudflareRuntime(): boolean {
  return typeof globalThis !== 'undefined' && 
         'caches' in globalThis && 
         typeof (globalThis as unknown as { WebSocketPair?: unknown }).WebSocketPair !== 'undefined';
}