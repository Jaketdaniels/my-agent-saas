import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireApiAuth } from '@/lib/auth';
import { z } from 'zod';


const readFileSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  encoding: z.string().optional(),
  sessionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const session = await requireApiAuth();
    const userId = session.user.id;

    // Get Cloudflare context
    const { env } = getCloudflareContext();

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
      validatedData = readFileSchema.parse(body);
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
    const sessionId = validatedData.sessionId || `user-${userId}-sandbox`;
    // Cast through unknown first due to CloudflareEnv type limitations
    const envTyped = env as unknown as { Sandbox: Parameters<typeof getSandbox>[0] };
    const sandboxStub = getSandbox(envTyped.Sandbox, sessionId);

    // Read file using sandbox
    try {
      const content = await sandboxStub.readFile(validatedData.path, { 
        encoding: validatedData.encoding || 'utf-8' 
      });
      return NextResponse.json({ 
        path: validatedData.path,
        content: content 
      });
    } catch (fileError: unknown) {
      const errorMessage = fileError instanceof Error ? fileError.message : 'Failed to read file';
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Read file error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { error: 'Failed to read file', details: errorMessage },
      { status: 500 }
    );
  }
}