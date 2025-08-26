import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { requireApiAuth } from '@/lib/auth';
import { agentInterpretSchema } from '@/schemas/agent-interpret.schema';
import { z } from 'zod';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    await requireApiAuth();

    // Get Cloudflare context
    const { env } = getRequestContext();

    // Validate and parse request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate with zod schema
    let validatedData;
    try {
      validatedData = agentInterpretSchema.parse(requestBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }

    const { message, code, language } = validatedData;

    // Import sandbox SDK dynamically for edge runtime
    const { getSandbox } = await import('@cloudflare/sandbox');

    // Get sandbox instance using correct env property name
    const sandbox = getSandbox(env.Sandbox, `user-session-${Date.now()}`);

    // Create code context
    const context = await sandbox.createCodeContext({
      language
    });

    // Execute code
    const execution = await sandbox.runCode(code || message || '', {
      context,
      onStdout: (output) => {
        console.log('Sandbox output:', output.text);
      }
    });

    return NextResponse.json({
      result: execution.text,
      outputs: execution.outputs,
      success: true
    });

  } catch (error) {
    console.error('Sandbox execution error:', error);
    
    // Handle specific error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { error: 'Code execution failed', details: errorMessage },
      { status: 500 }
    );
  }
}
