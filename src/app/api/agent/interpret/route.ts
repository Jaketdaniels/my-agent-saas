import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { requireApiAuth } from "@/lib/auth";
import { agentInterpretSchema } from "@/schemas/agent-interpret.schema";
import { z } from "zod";
import { getDB } from "@/db";
import { userTable, creditTransactionTable, CREDIT_TRANSACTION_TYPE } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

const AGENT_EXECUTION_COST = 1; // Credits per execution

export async function POST(request: NextRequest) {
  try {
    console.log("[API Interpret] Starting request processing");
    
    // Require authentication
    const session = await requireApiAuth();
    console.log("[API Interpret] Auth successful, user:", session.user.id);

    // Get Cloudflare context
    const { env } = getCloudflareContext();
    console.log("[API Interpret] Got Cloudflare context, env keys:", Object.keys(env || {}));

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
    console.log("[API Interpret] Processing:", { message: message?.substring(0, 50), language });

    // Check and deduct credits before execution
    const db = getDB();
    
    // Start transaction to atomically check and deduct credits
    const userId = session.user.id;
    
    // Get user's current credits
    const user = await db
      .select({ currentCredits: userTable.currentCredits })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .get();
    
    if (!user) {
      return NextResponse.json(
        {
          result: "",
          success: false,
          error: "User not found",
        } as import("@/types/agent").AgentInterpretResponse,
        { status: 404 }
      );
    }
    
    // Check if user has enough credits
    if (user.currentCredits < AGENT_EXECUTION_COST) {
      console.log("[API Interpret] Insufficient credits:", user.currentCredits, "needed:", AGENT_EXECUTION_COST);
      return NextResponse.json(
        {
          result: "",
          success: false,
          error: `Insufficient credits. You have ${user.currentCredits} credits, but need ${AGENT_EXECUTION_COST} credits to execute code.`,
        } as import("@/types/agent").AgentInterpretResponse,
        { status: 402 } // Payment Required
      );
    }
    
    // Deduct credits
    console.log("[API Interpret] Deducting", AGENT_EXECUTION_COST, "credits from user");
    await db
      .update(userTable)
      .set({ 
        currentCredits: sql`${userTable.currentCredits} - ${AGENT_EXECUTION_COST}`,
        updatedAt: new Date()
      })
      .where(eq(userTable.id, userId))
      .run();
    
    // Record the credit transaction
    await db
      .insert(creditTransactionTable)
      .values({
        userId,
        amount: -AGENT_EXECUTION_COST, // Negative for usage
        remainingAmount: 0,
        type: CREDIT_TRANSACTION_TYPE.USAGE,
        description: `Agent code execution (${language})`,
      })
      .run();
    
    console.log("[API Interpret] Credits deducted successfully");

    // Check if Sandbox binding exists
    const envAny = env as unknown as { Sandbox?: unknown };
    if (!envAny?.Sandbox) {
      console.error("[API Interpret] Sandbox binding not found in env");
      return NextResponse.json(
        {
          result: "",
          success: false,
          error: "Sandbox environment not configured. Please check Cloudflare bindings.",
        } as import("@/types/agent").AgentInterpretResponse,
        { status: 500 }
      );
    }

    // Load getSandbox using eval to bypass webpack bundling
    console.log("[API Interpret] Loading getSandbox...");
    const { loadGetSandbox } = await import("@/lib/cloudflare-runtime");
    const getSandbox = await loadGetSandbox();
    console.log("[API Interpret] getSandbox loaded successfully");

    // Get sandbox instance using correct env property name
    // Cast through unknown first due to CloudflareEnv type limitations
    const envTyped = env as unknown as {
      Sandbox: Parameters<typeof getSandbox>[0];
    };
    const sandboxId = `user-${session.user.id}-${Date.now()}`;
    console.log("[API Interpret] Creating sandbox with ID:", sandboxId);
    const sandbox = getSandbox(envTyped.Sandbox, sandboxId);

    // Create code context
    console.log("[API Interpret] Creating code context for language:", language);
    let context;
    try {
      context = await sandbox.createCodeContext({
        language,
      });
    } catch (error) {
      console.error("[API Interpret] Failed to create code context:", error);
      return NextResponse.json(
        {
          result: "",
          success: false,
          error: `Failed to create code context: ${error instanceof Error ? error.message : 'Unknown error'}`,
        } as import("@/types/agent").AgentInterpretResponse,
        { status: 500 }
      );
    }

    // Execute code
    console.log("[API Interpret] Executing code...");
    const codeToExecute = code || message || "print('Hello from netM8 Agent!')";
    let execution;
    try {
      execution = await sandbox.runCode(codeToExecute, {
        context,
        onStdout: (output: unknown) => {
          const outputObj = output as { text?: string };
          console.log("[API Interpret] Sandbox output:", outputObj.text);
        },
      });
    } catch (error) {
      console.error("[API Interpret] Execution failed:", error);
      return NextResponse.json(
        {
          result: "",
          success: false,
          error: `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        } as import("@/types/agent").AgentInterpretResponse,
        { status: 500 }
      );
    }

    console.log("[API Interpret] Execution completed, has error:", !!execution.error);

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
