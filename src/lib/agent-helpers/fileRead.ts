import type { Sandbox } from "@cloudflare/sandbox";
import { errorResponse, jsonResponse, parseJsonBody } from "./http";

type ReadFileBody = { path?: string; encoding?: 'utf8' | 'base64' };
export async function readFile(sandbox: Sandbox<unknown>, request: Request) {
  try {
  const body = await parseJsonBody<ReadFileBody>(request);
    const { path, encoding } = body;

    if (!path) {
      return errorResponse("Path is required");
    }

    const result = await sandbox.readFile(path, { encoding });
    return jsonResponse({
      success: true,
      path,
      content: result.content, // Extract the actual content string from the response
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error reading file:", error);
    return errorResponse(`Failed to read file: ${message}`);
  }
}