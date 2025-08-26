import type { Sandbox } from "@cloudflare/sandbox";
import { errorResponse, jsonResponse, parseJsonBody } from "../http";

type DeleteFileBody = { path?: string };
export async function deleteFile(sandbox: Sandbox<unknown>, request: Request) {
  try {
  const body = await parseJsonBody<DeleteFileBody>(request);
    const { path } = body;

    if (!path) {
      return errorResponse("Path is required");
    }

    await sandbox.deleteFile(path);
    return jsonResponse({ 
      success: true,
      message: "File deleted",
      path,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error deleting file:", error);
    return errorResponse(`Failed to delete file: ${message}`);
  }
}