import { getSandbox, proxyToSandbox, type Sandbox } from "@cloudflare/sandbox";
import {
  executeCommand,
  executeCommandStream,
  exposePort,
  getProcess,
  getProcessLogs,
  killProcesses,
  listProcesses,
  startProcess,
  streamProcessLogs,
  unexposePort,
  readFile,
  listFiles,
  deleteFile,
  renameFile,
  moveFile,
  createDirectory,
  gitCheckout,
  setupNextjs,
  setupReact,
  setupVue,
  setupStatic,
} from "./agent";
import { createSession, executeCell, deleteSession } from "./agent/notebook";
import { corsHeaders, errorResponse, jsonResponse, parseJsonBody } from "./http";

export { Sandbox } from "@cloudflare/sandbox";

// Helper function to generate cryptographically secure random strings
function generateSecureRandomString(length: number = 12): string {
      const { pathname } = new URL(request.url);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        const sandbox = getUserSandbox(env) as unknown as Sandbox<unknown>;

        // Try each route group handler; the first non-null response is returned
        const handlers: Array<() => Promise<Response | null>> = [
          () => handleNotebookRoutes(sandbox, request, pathname),
          () => handleCommandRoutes(sandbox, request, pathname),
          () => handleProcessRoutes(sandbox, request, pathname),
          () => handlePortRoutes(sandbox, request, pathname),
          () => handleFileRoutes(sandbox, request, pathname),
          () => handleTemplateRoutes(sandbox, request, pathname),
          () => handleExamplesRoutes(sandbox, request, pathname),
          () => handleSessionRoutes(sandbox, request, pathname),
          () => handleUtilityRoutes(sandbox, request, pathname, env),
        ];

        for (const getResponse of handlers) {
          const response = await getResponse();
          if (response) {
            return response;
          }
        }

        // Fallback: serve static assets for all other requests
        return env.ASSETS.fetch(request);

      } catch (error) {
        console.error("API Error:", error);
        const message = error instanceof Error ? error.message : String(error);
        return errorResponse(`Internal server error: ${message}`, 500);
      }
    },
  };

  // Route group handlers
  async function handleNotebookRoutes(sandbox: Sandbox<unknown>, request: Request, pathname: string): Promise<Response | null> {
    if (pathname === "/api/notebook/session" && request.method === "POST") {
      return await createSession(sandbox, request);
    }
    if (pathname === "/api/notebook/execute" && request.method === "POST") {
      return await executeCell(sandbox, request);
    }
    if (pathname === "/api/notebook/session" && request.method === "DELETE") {
      return await deleteSession(sandbox, request);
    }
    return null;
  }

  async function handleCommandRoutes(sandbox: Sandbox<unknown>, request: Request, pathname: string): Promise<Response | null> {
    if (pathname === "/api/execute" && request.method === "POST") {
      return await executeCommand(sandbox, request);
    }
    if (pathname === "/api/execute/stream" && request.method === "POST") {
      return await executeCommandStream(sandbox, request);
    }
    return null;
  }

  async function handleProcessRoutes(sandbox: Sandbox<unknown>, request: Request, pathname: string): Promise<Response | null> {
    if (pathname === "/api/process/list" && request.method === "GET") {
      return await listProcesses(sandbox);
    }
    if (pathname === "/api/process/start" && request.method === "POST") {
      return await startProcess(sandbox, request);
    }
    if (pathname.startsWith("/api/process/") && request.method === "DELETE") {
      return await killProcesses(sandbox, pathname);
    }
    if (pathname.startsWith("/api/process/") && pathname.endsWith("/logs") && request.method === "GET") {
      return await getProcessLogs(sandbox, pathname);
    }
    if (pathname.startsWith("/api/process/") && pathname.endsWith("/stream") && request.method === "GET") {
      return await streamProcessLogs(sandbox, pathname);
    }
    if (pathname.startsWith("/api/process/") && request.method === "GET") {
      return await getProcess(sandbox, pathname);
    }
    return null;
  }

  async function handlePortRoutes(sandbox: Sandbox<unknown>, request: Request, pathname: string): Promise<Response | null> {
    if (pathname === "/api/expose-port" && request.method === "POST") {
      return await exposePort(sandbox, request);
    }
    if (pathname === "/api/unexpose-port" && request.method === "POST") {
      return await unexposePort(sandbox, request);
    }
    if (pathname === "/api/exposed-ports" && request.method === "GET") {
      const hostname = new URL(request.url).host;
      const ports = await sandbox.getExposedPorts(hostname);
      return jsonResponse({ ports });
    }
    return null;
  }

  async function handleFileRoutes(sandbox: Sandbox<unknown>, request: Request, pathname: string): Promise<Response | null> {
    if (pathname === "/api/write" && request.method === "POST") {
      const body = await parseJsonBody(request);
      const { path, content, encoding } = body as { path?: string; content?: string; encoding?: string };
      if (!path || content === undefined) {
        return errorResponse("Path and content are required");
      }
      await sandbox.writeFile(path, content, { encoding });
      return jsonResponse({ message: "File written", path });
    }
    if (pathname === "/api/read" && request.method === "POST") {
      return await readFile(sandbox, request);
    }
    if (pathname === "/api/list-files" && request.method === "POST") {
      return await listFiles(sandbox, request);
    }
    if (pathname === "/api/delete" && request.method === "POST") {
      return await deleteFile(sandbox, request);
    }
    if (pathname === "/api/rename" && request.method === "POST") {
      return await renameFile(sandbox, request);
    }
    if (pathname === "/api/move" && request.method === "POST") {
      return await moveFile(sandbox, request);
    }
    if (pathname === "/api/mkdir" && request.method === "POST") {
      return await createDirectory(sandbox, request);
    }
    if (pathname === "/api/git/checkout" && request.method === "POST") {
      return await gitCheckout(sandbox, request);
    }
    return null;
  }

  async function handleTemplateRoutes(sandbox: Sandbox<unknown>, request: Request, pathname: string): Promise<Response | null> {
    if (pathname === "/api/templates/nextjs" && request.method === "POST") {
      return await setupNextjs(sandbox, request);
    }
    if (pathname === "/api/templates/react" && request.method === "POST") {
      return await setupReact(sandbox, request);
    }
    if (pathname === "/api/templates/vue" && request.method === "POST") {
      return await setupVue(sandbox, request);
    }
    if (pathname === "/api/templates/static" && request.method === "POST") {
      return await setupStatic(sandbox, request);
    }
    return null;
  }

  async function handleExamplesRoutes(sandbox: Sandbox<unknown>, request: Request, pathname: string): Promise<Response | null> {
    if (pathname === "/api/examples/basic-python" && request.method === "GET") {
      try {
        const pythonCtx = await sandbox.createCodeContext({ language: 'python' });
        const execution = await sandbox.runCode('print("Hello from Python!")', { context: pythonCtx });
        return jsonResponse({
          output: execution.logs.stdout.join(''),
          errors: execution.error
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResponse(message || "Failed to run example", 500);
      }
    }

    if (pathname === "/api/examples/chart" && request.method === "GET") {
      try {
        const ctx = await sandbox.createCodeContext({ language: 'python' });
        const execution = await sandbox.runCode(`
        return await setupReact(sandbox, request);
      }

      if (pathname === "/api/templates/vue" && request.method === "POST") {
        return await setupVue(sandbox, request);
      }

      if (pathname === "/api/templates/static" && request.method === "POST") {
        return await setupStatic(sandbox, request);
      }

      // Code Interpreter Example APIs
      if (pathname === "/api/examples/basic-python" && request.method === "GET") {
        try {
        const chartResult = execution.results[0];
        const formats: string[] = [];
        if (chartResult) {
          if (chartResult.text) { formats.push('text'); }
          if (chartResult.html) { formats.push('html'); }
          if (chartResult.png) { formats.push('png'); }
          if (chartResult.jpeg) { formats.push('jpeg'); }
          if (chartResult.svg) { formats.push('svg'); }
        }
        return jsonResponse({
          chart: chartResult?.png ? `data:image/png;base64,${chartResult.png}` : null,
          formats
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResponse(message || "Failed to run example", 500);
      }
    }

    if (pathname === "/api/examples/javascript" && request.method === "GET") {
      try {
        const jsCtx = await sandbox.createCodeContext({ language: 'javascript' });
        const execution = await sandbox.runCode(`
          const pythonCtx = await sandbox.createCodeContext({ language: 'python' });
          const execution = await sandbox.runCode('print("Hello from Python!")', { 
            context: pythonCtx 
          });
          
          // The execution object now has a toJSON method
          return jsonResponse({
            output: execution.logs.stdout.join(''),
        return jsonResponse({ output: execution.logs.stdout.join('\n') });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResponse(message || "Failed to run example", 500);
      }
    }

    if (pathname === "/api/examples/error" && request.method === "GET") {
      try {
        const ctx = await sandbox.createCodeContext({ language: 'python' });
        const execution = await sandbox.runCode(`
            errors: execution.error
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return errorResponse(message || "Failed to run example", 500);
        return jsonResponse({
          error: execution.error ? {
            name: execution.error.name,
            message: execution.error.value,
            traceback: execution.error.traceback
          } : null
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return errorResponse(message || "Failed to run example", 500);
      }
    }
    return null;
  }

  async function handleSessionRoutes(sandbox: Sandbox<unknown>, request: Request, pathname: string): Promise<Response | null> {
    if (pathname === "/api/session/create" && request.method === "POST") {
      const body = await parseJsonBody(request);
      const sessionId = (body as { sessionId?: string }).sessionId || `session_${Date.now()}_${generateSecureRandomString()}`;
      return jsonResponse(sessionId);
    }
    if (pathname.startsWith("/api/session/clear/") && request.method === "POST") {
      const sessionId = pathname.split("/").pop();
      return jsonResponse({ message: "Session cleared", sessionId });
    }
    return null;
  }

  async function handleUtilityRoutes(
    sandbox: Sandbox<unknown>,
    request: Request,
    pathname: string,
    env: Env
  ): Promise<Response | null> {
    if (pathname === "/health") {
      return jsonResponse({
        status: "healthy",
        timestamp: new Date().toISOString(),
        message: "Sandbox SDK Tester is running",
        apis: [
          "POST /api/execute - Execute commands",
          "POST /api/execute/stream - Execute with streaming",
          "GET /api/process/list - List processes",
          "POST /api/process/start - Start process",
          "DELETE /api/process/{id} - Kill process",
          "GET /api/process/{id}/logs - Get process logs",
          "GET /api/process/{id}/stream - Stream process logs",
          "POST /api/expose-port - Expose port",
          "GET /api/exposed-ports - List exposed ports",
          "POST /api/write - Write file",
          "POST /api/read - Read file",
          "POST /api/list-files - List files in directory",
          "POST /api/delete - Delete file",
          "POST /api/rename - Rename file",
          "POST /api/move - Move file",
          "POST /api/mkdir - Create directory",
          "POST /api/git/checkout - Git checkout",
          "POST /api/templates/nextjs - Setup Next.js project",
          "POST /api/templates/react - Setup React project",
          "POST /api/templates/vue - Setup Vue project",
          "POST /api/templates/static - Setup static site",
          "POST /api/notebook/session - Create notebook session",
          "POST /api/notebook/execute - Execute notebook cell",
          "DELETE /api/notebook/session - Delete notebook session",
          "GET /api/examples/basic-python - Basic Python example",
          "GET /api/examples/chart - Chart generation example",
          "GET /api/examples/javascript - JavaScript execution example",
          "GET /api/examples/error - Error handling example",
        ]
      });
    }
    if (pathname === "/api/ping") {
      try {
        await sandbox.exec("echo 'Sandbox initialized'");
        return jsonResponse({
          message: "pong",
          timestamp: new Date().toISOString(),
          sandboxStatus: "ready"
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({
          message: "pong",
          timestamp: new Date().toISOString(),
          sandboxStatus: "initializing",
          error: message
        }, 202);
      }
    }
    // Fallback for this group: let caller continue
    return null;
        }
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return errorResponse(message || "Failed to run example", 500);
        }
      }

      // Health check endpoint
      if (pathname === "/health") {
        return jsonResponse({
          status: "healthy",
          timestamp: new Date().toISOString(),
          message: "Sandbox SDK Tester is running",
          apis: [
            "POST /api/execute - Execute commands",
            "POST /api/execute/stream - Execute with streaming",
            "GET /api/process/list - List processes",
            "POST /api/process/start - Start process",
            "DELETE /api/process/{id} - Kill process",
            "GET /api/process/{id}/logs - Get process logs",
            "GET /api/process/{id}/stream - Stream process logs",
            "POST /api/expose-port - Expose port",
            "GET /api/exposed-ports - List exposed ports",
            "POST /api/write - Write file",
            "POST /api/read - Read file",
            "POST /api/list-files - List files in directory",
            "POST /api/delete - Delete file",
            "POST /api/rename - Rename file",
            "POST /api/move - Move file",
            "POST /api/mkdir - Create directory",
            "POST /api/git/checkout - Git checkout",
            "POST /api/templates/nextjs - Setup Next.js project",
            "POST /api/templates/react - Setup React project",
            "POST /api/templates/vue - Setup Vue project",
            "POST /api/templates/static - Setup static site",
            "POST /api/notebook/session - Create notebook session",
            "POST /api/notebook/execute - Execute notebook cell",
            "DELETE /api/notebook/session - Delete notebook session",
            "GET /api/examples/basic-python - Basic Python example",
            "GET /api/examples/chart - Chart generation example",
            "GET /api/examples/javascript - JavaScript execution example",
            "GET /api/examples/error - Error handling example",
          ]
        });
      }

      // Ping endpoint that actually initializes the container
      if (pathname === "/api/ping") {
        try {
          // Test the actual sandbox connection by calling a simple method
          // This will initialize the sandbox if it's not already running
          await sandbox.exec("echo 'Sandbox initialized'");
          return jsonResponse({
            message: "pong",
            timestamp: new Date().toISOString(),
            sandboxStatus: "ready"
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return jsonResponse({
            message: "pong",
            timestamp: new Date().toISOString(),
            sandboxStatus: "initializing",
            error: message
          }, 202); // 202 Accepted - processing in progress
        }
      }

      // Session Management APIs
      if (pathname === "/api/session/create" && request.method === "POST") {
        const body = await parseJsonBody(request);
        const sessionId = body.sessionId || `session_${Date.now()}_${generateSecureRandomString()}`;

        // Sessions are managed automatically by the SDK, just return the ID
        return jsonResponse(sessionId);
      }

      if (pathname.startsWith("/api/session/clear/") && request.method === "POST") {
        const sessionId = pathname.split("/").pop();

        // In a real implementation, you might want to clean up session state
        // For now, just return success
        return jsonResponse({ message: "Session cleared", sessionId });
      }

      // Fallback: serve static assets for all other requests
      return env.ASSETS.fetch(request);

    } catch (error) {
      console.error("API Error:", error);
      const message = error instanceof Error ? error.message : String(error);
      return errorResponse(`Internal server error: ${message}`, 500);
    }
  },
};

export default apiRouter;