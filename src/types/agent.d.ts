// Agent API Type Definitions
import type { ISandbox } from '@cloudflare/sandbox';

// Re-export Sandbox types
export type { 
  ISandbox,
  ExecResult,
  ExecOptions,
  Process,
  ProcessStatus,
  ProcessOptions,
  StreamOptions,
  ExecutionSession,
  ReadFileResponse,
  WriteFileResponse,
  ListFilesResponse,
  DeleteFileResponse,
  RenameFileResponse,
  MoveFileResponse,
  MkdirResponse,
  GitCheckoutResponse
} from '@cloudflare/sandbox';

// Agent-specific request/response types
export interface AgentExecuteRequest {
  command: string;
  sessionId?: string;
  cwd?: string;
  env?: Record<string, string>;
}

export interface AgentExecuteResponse {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  command: string;
  duration: number;
}

export interface AgentProcessStartRequest {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  sessionId?: string;
}

export interface AgentProcessResponse {
  id: string;
  pid: number;
  status: ProcessStatus;
  command: string;
  args?: string[];
  cwd?: string;
  startTime: number;
}

export interface AgentFileRequest {
  path: string;
  encoding?: string;
}

export interface AgentFileWriteRequest extends AgentFileRequest {
  content: string;
}

export interface AgentFileListRequest {
  path?: string;
}

export interface AgentFileRenameRequest {
  oldPath: string;
  newPath: string;
}

export interface AgentFileMoveRequest {
  source: string;
  destination: string;
}

export interface AgentPortRequest {
  port: number;
  protocol?: 'http' | 'https';
}

export interface AgentPortResponse {
  port: number;
  url: string;
  protocol: string;
}

export interface AgentInterpretRequest {
  message?: string;
  code?: string;
  language: 'python' | 'javascript' | 'typescript';
}

export interface AgentInterpretResponse {
  result: string;
  outputs?: any[];
  success: boolean;
  error?: string;
}

export interface AgentUploadFile {
  name: string;
  type: string;
  size: number;
  content?: string;
  base64?: string;
}

export interface AgentUploadResponse {
  success: boolean;
  files: Array<{
    name: string;
    type: string;
    size: number;
    processed: boolean;
  }>;
  message: string;
}

// Template setup requests
export interface AgentTemplateRequest {
  projectName?: string;
  options?: Record<string, any>;
}

export interface AgentTemplateResponse {
  success: boolean;
  message: string;
  projectPath?: string;
}

// Notebook types
export interface AgentNotebookSessionRequest {
  sessionId?: string;
  kernelName?: string;
}

export interface AgentNotebookExecuteRequest {
  sessionId: string;
  code: string;
  cellId?: string;
}

export interface AgentNotebookResponse {
  sessionId: string;
  status: 'created' | 'executing' | 'idle' | 'deleted';
  result?: any;
  outputs?: any[];
  error?: string;
}