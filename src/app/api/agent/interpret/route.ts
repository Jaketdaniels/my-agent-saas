import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Get Cloudflare context
    const { env } = getRequestContext();

    const { message, code, language = 'python' } = await request.json();

    // Import sandbox SDK dynamically for edge runtime
    const { getSandbox } = await import('@cloudflare/sandbox');

    // Get sandbox instance
    const sandbox = getSandbox(env.SANDBOX, `user-session-${Date.now()}`);

    // Create code context
    const context = await sandbox.createCodeContext({
      language: language as 'python' | 'javascript' | 'typescript'
    });

    // Execute code
    const execution = await sandbox.runCode(code || message, {
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
    return NextResponse.json(
      { error: 'Code execution failed', details: error.message },
      { status: 500 }
    );
  }
}
