import type { Sandbox } from "@cloudflare/sandbox";
import { errorResponse, jsonResponse, parseJsonBody } from "./http";

type MkdirBody = { path?: string; recursive?: boolean };

export async function createDirectory(sandbox: Sandbox<unknown>, request: Request) {
  try {
  const body = await parseJsonBody<MkdirBody>(request);
    const { path, recursive } = body;

    if (!path) {
      return errorResponse("Path is required");
    }

    await sandbox.mkdir(path, { recursive });
    return jsonResponse({
      success: true,
      message: "Directory created",
      path,
      recursive: recursive || false,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error creating directory:", error);
    return errorResponse(`Failed to create directory: ${message}`);
  }
}