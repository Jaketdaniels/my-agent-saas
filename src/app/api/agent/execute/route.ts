import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { requireApiAuth } from '@/lib/auth';
import { z } from 'zod';


// Request validation schema
const executeSchema = z.object({
  command: z.string().min(1, 'Command is required'),
  sessionId: z.string().optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await requireApiAuth();
    const userId = session.user.id;

    // Get Cloudflare context
    const { env } = getRequestContext();

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    let validatedData;
    try {
      validatedData = executeSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }

    // Load getSandbox using eval to bypass webpack bundling
    const { loadGetSandbox } = await import('@/lib/cloudflare-runtime');
    const getSandbox = await loadGetSandbox();
    
    // Get user's sandbox instance
    const sandboxId = validatedData.sessionId || `user-${userId}-sandbox`;
    // Cast through unknown first due to CloudflareEnv type limitations
    const envTyped = env as unknown as { Sandbox: Parameters<typeof getSandbox>[0] };
    const sandboxStub = getSandbox(envTyped.Sandbox, sandboxId);

    // Execute the command directly using the sandbox stub
    const result = await sandboxStub.exec(validatedData.command, { 
      cwd: validatedData.cwd,
      env: validatedData.env 
    });
    
    // Return the formatted response
    return NextResponse.json({
      success: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      command: result.command,
      duration: result.duration
    });

  } catch (error) {
    console.error('Execute command error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: 'Command execution failed', details: errorMessage },
      { status: 500 }
    );
  }
}