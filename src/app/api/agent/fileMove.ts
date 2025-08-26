import type { Sandbox } from "@cloudflare/sandbox";
import { errorResponse, jsonResponse, parseJsonBody } from "../http";

type MoveFileBody = { sourcePath?: string; destinationPath?: string };
export async function moveFile(sandbox: Sandbox<unknown>, request: Request) {
  try {
  const body = await parseJsonBody<MoveFileBody>(request);
    const { sourcePath, destinationPath } = body;

    if (!sourcePath || !destinationPath) {
      return errorResponse("sourcePath and destinationPath are required");
    }

    await sandbox.moveFile(sourcePath, destinationPath);
    return jsonResponse({ 
      success: true,
      message: "File moved",
      sourcePath,
      destinationPath,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error moving file:", error);
    return errorResponse(`Failed to move file: ${message}`);
  }
}