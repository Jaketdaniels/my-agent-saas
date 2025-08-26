import { parseSSEStream, type ExecEvent, type Sandbox } from "@cloudflare/sandbox";
import { corsHeaders, errorResponse, parseJsonBody } from "./http";

interface ExecuteStreamBody {
    command?: string;
    sessionId?: string;
}

export async function executeCommandStream(sandbox: Sandbox<unknown>, request: Request) {
    const body = await parseJsonBody<ExecuteStreamBody>(request);
    const { command, sessionId } = body;

    if (!command) {
        return errorResponse("Command is required");
    }

    // Create readable stream for SSE
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();

    // Start streaming in the background
    (async () => {
        try {
            const encoder = new TextEncoder();

            // Get the ReadableStream from sandbox
            const stream = await sandbox.execStream(command);

            // Convert to AsyncIterable using parseSSEStream
            for await (const event of parseSSEStream<ExecEvent>(stream)) {
                // Forward each typed event as SSE
                await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const errorEvent = {
                type: 'error',
                timestamp: new Date().toISOString(),
                error: message
            };
            await writer.write(new TextEncoder().encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
        } finally {
            await writer.close();
        }
    })();

    return new Response(readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            ...corsHeaders(),
        },
    });
}
