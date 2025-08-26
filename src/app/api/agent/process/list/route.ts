import { NextRequest, NextResponse } from "next/server";
import { getRequestContext } from "@cloudflare/next-on-pages";
import { requireApiAuth } from "@/lib/auth";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const session = await requireApiAuth();
    const userId = session.user.id;

    // Get Cloudflare context
    const { env } = getRequestContext();

    // Get sessionId from query params
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId") || `user-${userId}-sandbox`;

    // Load getSandbox using eval to bypass webpack bundling
    const { loadGetSandbox } = await import("@/lib/cloudflare-runtime");
    const getSandbox = await loadGetSandbox();

    // Get user's sandbox instance
    // Cast through unknown first due to CloudflareEnv type limitations
    const envTyped = env as unknown as {
      Sandbox: Parameters<typeof getSandbox>[0];
    };
    const sandboxStub = getSandbox(envTyped.Sandbox, sessionId);

    // List processes directly using sandbox
    const processes = await sandboxStub.listProcesses();

    return NextResponse.json({
      processes: processes || [],
    });
  } catch (error) {
    console.error("List processes error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: "Failed to list processes", details: errorMessage },
      { status: 500 }
    );
  }
}
