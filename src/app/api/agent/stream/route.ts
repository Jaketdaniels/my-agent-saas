import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireApiAuth } from '@/lib/auth';
import { z } from 'zod';

// Request validation schema
const streamSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  code: z.string().optional(),
  language: z.enum(['python', 'javascript', 'typescript']).default('python'),
  sessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await requireApiAuth();
    const userId = session.user.id;

    // Parse and validate request body
    const body = await request.json();
    const validatedData = streamSchema.parse(body);

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial acknowledgment
          controller.enqueue(encoder.encode(`data: {"type":"start","message":"Processing your request..."}\n\n`));

          // Get Cloudflare context
          const { env } = getCloudflareContext();
          
          // Check if Sandbox binding exists
          const envAny = env as unknown as { Sandbox?: unknown };
          if (!envAny?.Sandbox) {
            controller.enqueue(encoder.encode(`data: {"type":"error","message":"Sandbox environment not configured"}\n\n`));
            controller.close();
            return;
          }

          // Load getSandbox
          const { loadGetSandbox } = await import('@/lib/cloudflare-runtime');
          const getSandbox = await loadGetSandbox();
          
          // Get sandbox instance
          const envTyped = env as unknown as { Sandbox: Parameters<typeof getSandbox>[0] };
          const sandboxId = validatedData.sessionId || `user-${userId}-${Date.now()}`;
          const sandbox = getSandbox(envTyped.Sandbox, sandboxId);

          // Send status update
          controller.enqueue(encoder.encode(`data: {"type":"status","message":"Initializing code environment..."}\n\n`));

          // Create code context
          const context = await sandbox.createCodeContext({
            language: validatedData.language,
          });

          // Send status update
          controller.enqueue(encoder.encode(`data: {"type":"status","message":"Executing code..."}\n\n`));

          // Prepare code to execute
          const codeToExecute = validatedData.code || validatedData.message;
          
          // Execute code with streaming output
          const outputBuffer: string[] = [];
          const execution = await sandbox.runCode(codeToExecute, {
            context,
            onStdout: (output: unknown) => {
              const outputObj = output as { text?: string };
              if (outputObj.text) {
                outputBuffer.push(outputObj.text);
                // Send output in real-time
                controller.enqueue(encoder.encode(`data: {"type":"output","content":"${outputObj.text.replace(/\n/g, '\\n').replace(/"/g, '\\"')}"}\n\n`));
              }
            },
            onStderr: (output: unknown) => {
              const outputObj = output as { text?: string };
              if (outputObj.text) {
                // Send error output
                controller.enqueue(encoder.encode(`data: {"type":"error_output","content":"${outputObj.text.replace(/\n/g, '\\n').replace(/"/g, '\\"')}"}\n\n`));
              }
            },
          });

          // Check for execution errors
          if (execution.error) {
            const errorMessage = `${execution.error.name}: ${execution.error.value}\\n${execution.error.traceback.join('\\n')}`;
            controller.enqueue(encoder.encode(`data: {"type":"error","message":"${errorMessage.replace(/"/g, '\\"')}"}\n\n`));
          } else {
            // Send final result
            const result = execution.results.length > 0 ? JSON.stringify(execution.results) : outputBuffer.join('\\n');
            controller.enqueue(encoder.encode(`data: {"type":"result","content":"${result.replace(/"/g, '\\"')}"}\n\n`));
          }

          // Send completion signal
          controller.enqueue(encoder.encode(`data: {"type":"done","message":"Execution completed"}\n\n`));
          
        } catch (error) {
          console.error('[Stream API] Error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          controller.enqueue(encoder.encode(`data: {"type":"error","message":"${errorMessage.replace(/"/g, '\\"')}"}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Content-Type-Options': 'nosniff',
      }
    });

  } catch (error) {
    console.error('[Stream API] Request error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: 'Stream initialization failed', details: errorMessage },
      { status: 500 }
    );
  }
}