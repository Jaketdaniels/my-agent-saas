import type { Sandbox } from "@cloudflare/sandbox";
import { parseJsonBody, errorResponse, jsonResponse } from "./http";

interface ExecuteCommandBody {
    command?: string;
    sessionId?: string;
    cwd?: string;
    env?: Record<string, string>;
}

export async function executeCommand(sandbox: Sandbox<unknown>, request: Request) {
    const body = await parseJsonBody<ExecuteCommandBody>(request);
    const { command, sessionId, cwd, env } = body;
    if (!command) {
        return errorResponse("Command is required");
    }

    // Use the current SDK API signature: exec(command, options)
    const result = await sandbox.exec(command, { cwd, env });
    return jsonResponse({
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        command: result.command,
        duration: result.duration
    });
}
