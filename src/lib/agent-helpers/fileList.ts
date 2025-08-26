import type { Sandbox } from "@cloudflare/sandbox";
import { errorResponse, jsonResponse, parseJsonBody } from "./http";

type ListFilesBody = { path?: string; options?: { recursive?: boolean } };
export async function listFiles(sandbox: Sandbox<unknown>, request: Request) {
  try {
  const body = await parseJsonBody<ListFilesBody>(request);
    const { path, options } = body;

    if (!path) {
      return errorResponse("Path is required");
    }

    const result = await sandbox.listFiles(path, options);
    return jsonResponse({
      success: true,
      path,
      files: result.files,
      count: result.files.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error listing files:", error);
    return errorResponse(`Failed to list files: ${message}`);
  }
}