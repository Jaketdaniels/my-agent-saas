import type { Sandbox } from "@cloudflare/sandbox";
import { isJupyterNotReadyError, isRetryableError } from "@cloudflare/sandbox";
import { corsHeaders, errorResponse, jsonResponse, parseJsonBody } from "./http";

// Active sessions (in production, use Durable Objects or KV)
const sessions = new Map<string, { contextId: string; language: string }>();

// Create a new notebook session
export async function createSession(sandbox: Sandbox, request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody(request) as { language?: string };
    const { language = 'python' } = body;

    // Create a code context for this session
    const context = await sandbox.createCodeContext({ language: language as 'python' | 'javascript' | 'typescript' });
    const sessionId = `session-${Date.now()}-${crypto.randomUUID()}`;

    sessions.set(sessionId, {
      contextId: context.id,
      language
    });

    return jsonResponse({ sessionId, language });
  } catch (error) {
    // Handle Jupyter initialization timeout (request waited but Jupyter wasn't ready in time)
    if (isJupyterNotReadyError(error)) {
      console.log("[Notebook] Request timed out waiting for Jupyter initialization");
      return new Response(
        JSON.stringify({
          error: error.message,
          retryAfter: error.retryAfter,
          progress: error.progress
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(error.retryAfter),
            ...corsHeaders()
          }
        }
      );
    }

    // Check if error is retryable
    if (isRetryableError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("[Notebook] Retryable error:", message);
      return errorResponse(message, 503);
    }

    // Log actual errors
  console.error("Create session error:", error);
  const message = error instanceof Error ? error.message : "Failed to create session";
  return errorResponse(message, 500);
  }
}

// Execute code in a notebook session
export async function executeCell(sandbox: Sandbox, request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody(request) as { code?: string; sessionId?: string; language?: string };
    const { code, sessionId, language = 'python' } = body;

    if (!code) {
      return errorResponse("Code is required", 400);
    }

    // Get or create session
    let session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session) {
      // Auto-create session if it doesn't exist
      const context = await sandbox.createCodeContext({ language: language as 'python' | 'javascript' | 'typescript' });
      session = { contextId: context.id, language };
      if (sessionId) {
        sessions.set(sessionId, session);
      }
    }

    // Execute code with streaming
    const stream = await sandbox.runCodeStream(code, {
      context: { 
        id: session.contextId,
        language: session.language as 'python' | 'javascript',
        cwd: process.cwd(),
        createdAt: new Date(),
        lastUsed: new Date()
      },
      language: session.language as 'python' | 'javascript'
    });

    // Transform the stream to SSE format
    const encoder = new TextEncoder();
    const transformedStream = new ReadableStream({
      async start(controller) {
        const reader = stream.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              break;
            }

            // Parse the JSON from the stream
            const text = new TextDecoder().decode(value);
            const lines = text.split('\n').filter(line => line.trim());

            for (const line of lines) {
              try {
                const data = JSON.parse(line);
                // Format as SSE
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
              } catch {
                // Skip invalid JSON
              }
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(transformedStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders()
      }
    });
  } catch (error) {
    // Handle Jupyter initialization timeout (request waited but Jupyter wasn't ready in time)
    if (isJupyterNotReadyError(error)) {
      console.log("[Notebook] Request timed out waiting for Jupyter initialization");
      return new Response(
        JSON.stringify({
          error: error.message,
          retryAfter: error.retryAfter,
          progress: error.progress
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(error.retryAfter),
            ...corsHeaders()
          }
        }
      );
    }

    // Check if error is retryable
    if (isRetryableError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("[Notebook] Retryable error:", message);
      return errorResponse(message, 503);
    }

    // Log actual errors
  console.error("Execute cell error:", error);
  const message = error instanceof Error ? error.message : "Failed to execute code";
  return errorResponse(message, 500);
  }
}

// Clean up a session
export async function deleteSession(sandbox: Sandbox, request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody(request) as { sessionId?: string };
    const { sessionId } = body;
    const session = sessionId ? sessions.get(sessionId) : undefined;

    if (session) {
      // Delete the context
      await sandbox.deleteCodeContext(session.contextId);
      if (sessionId) {
        sessions.delete(sessionId);
      }
    }

    return jsonResponse({ success: true });
  } catch (error) {
    // Handle Jupyter initialization timeout (request waited but Jupyter wasn't ready in time)
    if (isJupyterNotReadyError(error)) {
      console.log("[Notebook] Request timed out waiting for Jupyter initialization");
      return new Response(
        JSON.stringify({
          error: error.message,
          retryAfter: error.retryAfter,
          progress: error.progress
        }),
        {
          status: 503,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": String(error.retryAfter),
            ...corsHeaders()
          }
        }
      );
    }

    // Check if error is retryable
    if (isRetryableError(error)) {
      const message = error instanceof Error ? error.message : String(error);
      console.log("[Notebook] Retryable error:", message);
      return errorResponse(message, 503);
    }

    // Log actual errors
  console.error("Delete session error:", error);
  const message = error instanceof Error ? error.message : "Failed to delete session";
  return errorResponse(message, 500);
  }
}