import type { Sandbox } from "@cloudflare/sandbox";
import { errorResponse, jsonResponse, parseJsonBody } from "../http";

type RenameFileBody = { oldPath?: string; newPath?: string };
export async function renameFile(sandbox: Sandbox<unknown>, request: Request) {
  try {
  const body = await parseJsonBody<RenameFileBody>(request);
    const { oldPath, newPath } = body;

    if (!oldPath || !newPath) {
      return errorResponse("oldPath and newPath are required");
    }

    await sandbox.renameFile(oldPath, newPath);
    return jsonResponse({ 
      success: true,
      message: "File renamed",
      oldPath,
      newPath,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error renaming file:", error);
    return errorResponse(`Failed to rename file: ${message}`);
  }
}