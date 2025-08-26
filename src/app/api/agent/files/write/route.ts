import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { requireApiAuth } from "@/lib/auth";
import { z } from "zod";

const writeFileSchema = z.object({
  path: z.string().min(1, "Path is required"),
  content: z.string(),
  encoding: z.string().optional(),
  sessionId: z.string().optional(),
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
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    let validatedData;
    try {
      validatedData = writeFileSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", details: error.errors },
          { status: 400 }
        );
      }
      throw error;
    }

    const {
      path,
      content,
      encoding,
      sessionId: requestSessionId,
    } = validatedData;

    // Load getSandbox using eval to bypass webpack bundling
    const { loadGetSandbox } = await import("@/lib/cloudflare-runtime");
    const getSandbox = await loadGetSandbox();

    // Get user's sandbox instance
    const sessionId = requestSessionId || `user-${userId}-sandbox`;
    // Cast through unknown first due to CloudflareEnv type limitations
    const envTyped = env as unknown as {
      Sandbox: Parameters<typeof getSandbox>[0];
    };
    const sandboxStub = getSandbox(envTyped.Sandbox, sessionId);

    // Write the file
    await sandboxStub.writeFile(path, content, { encoding });

    return NextResponse.json({
      success: true,
      message: "File written successfully",
      path,
    });
  } catch (error) {
    console.error("Write file error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to write file", details: errorMessage },
      { status: 500 }
    );
  }
}
