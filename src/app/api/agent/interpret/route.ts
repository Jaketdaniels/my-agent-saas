import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { requireApiAuth } from "@/lib/auth";
import { agentInterpretSchema } from "@/schemas/agent-interpret.schema";
import { z } from "zod";

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
        { error: "Invalid JSON in request body" },
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
          { error: "Validation failed", details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }

    const { message, code, language } = validatedData;

    // Load getSandbox using eval to bypass webpack bundling
    const { loadGetSandbox } = await import("@/lib/cloudflare-runtime");
    const getSandbox = await loadGetSandbox();

    // Get sandbox instance using correct env property name
    // Cast through unknown first due to CloudflareEnv type limitations
    const envTyped = env as unknown as {
      Sandbox: Parameters<typeof getSandbox>[0];
    };
    const sandbox = getSandbox(envTyped.Sandbox, `user-session-${Date.now()}`);

    // Create code context
    const context = await sandbox.createCodeContext({
      language,
    });

    // Execute code
    const execution = await sandbox.runCode(code || message || "", {
      context,
      onStdout: (output: unknown) => {
        const outputObj = output as { text?: string };
        console.log("Sandbox output:", outputObj.text);
      },
    });

    // Check if there was an execution error
    if (execution.error) {
      return NextResponse.json({
        result: "",
        outputs: execution.results,
        success: false,
        error: `${execution.error.name}: ${
          execution.error.value
        }\n${execution.error.traceback.join("\n")}`,
      });
    }

    // Combine stdout and any text results for the main result
    const stdoutResult = execution.logs.stdout.join("\n");
    const stderrResult =
      execution.logs.stderr.length > 0 ? execution.logs.stderr.join("\n") : "";

    // Extract any additional outputs from results (images, html, etc)
    // Cast to unknown[] to avoid TypeScript deep instantiation issues
    const outputs: unknown[] =
      execution.results.length > 0 ? execution.results : [];

    return NextResponse.json({
      result: stderrResult
        ? `${stdoutResult}\n[stderr]: ${stderrResult}`
        : stdoutResult,
      outputs: outputs.length > 0 ? outputs : undefined,
      success: true,
    } as import("@/types/agent").AgentInterpretResponse);
  } catch (error) {
    console.error("Sandbox execution error:", error);

    // Handle specific error types
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Return error response matching AgentInterpretResponse interface
    return NextResponse.json(
      {
        result: "",
        success: false,
        error: `Code execution failed: ${errorMessage}`,
      } as import("@/types/agent").AgentInterpretResponse,
      { status: 500 }
    );
  }
}
