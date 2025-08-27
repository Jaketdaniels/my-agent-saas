"use client";

import { useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

enum OutputType {
  Text = "text",
  Image = "image",
}

interface Output {
  id?: string;
  type: OutputType;
  data: string;
}

enum Role {
  User = "user",
  Assistant = "assistant",
}

interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date;
  outputs: Output[];
}

enum ImageFormat {
  Png = "png",
  Jpeg = "jpeg",
  SvgXml = "svg+xml",
}

type BlobLike =
  | string
  | {
      data?: string;
      base64?: string;
      value?: string;
    };

interface InterpreterOutput {
  png?: BlobLike;
  jpeg?: BlobLike;
  svg?: BlobLike;
  text?: string;
  html?: string;
}

function asString(val: BlobLike | undefined): string | undefined {
  if (typeof val === "string") {
    return val;
  }
  if (val && typeof val === "object") {
    const v = val as { data?: string; base64?: string; value?: string };
    if (typeof v.data === "string") {
      return v.data;
    }
    if (typeof v.base64 === "string") {
      return v.base64;
    }
    if (typeof v.value === "string") {
      return v.value;
    }
  }
  return undefined;
}

function getImageParts(
  obj: InterpreterOutput
): { format: ImageFormat; data: string } | undefined {
  if (obj.png) {
    const data = asString(obj.png);
    if (data) {
      return { format: ImageFormat.Png, data };
    }
  }
  if (obj.jpeg) {
    const data = asString(obj.jpeg);
    if (data) {
      return { format: ImageFormat.Jpeg, data };
    }
  }
  if (obj.svg) {
    const data = asString(obj.svg);
    if (data) {
      return { format: ImageFormat.SvgXml, data };
    }
  }
  return undefined;
}

function getTextOutput(obj: InterpreterOutput, fallback: unknown): string {
  const text = obj.text || obj.html;
  return typeof text === "string" && text.length > 0
    ? text
    : JSON.stringify(fallback);
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleFileUpload = async (files: FileList) => {
    // Implement file upload to agent context
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));

    try {
      const response = await fetch("/api/agent/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setUploadedFiles((prev) => [...prev, ...Array.from(files)]);
        toast.success("Files uploaded successfully");
      } else {
        toast.error("Failed to upload files");
      }
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload files");
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.User,
      content: input,
      timestamp: new Date(),
      outputs: [],
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      console.log("[AgentChat] Sending message to API:", input);
      
      const response = await fetch("/api/agent/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          code: input, // For code execution
          language: "python",
        }),
      });

      console.log("[AgentChat] Response status:", response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.error("[AgentChat] API error response:", errorData);
        throw new Error(`API returned ${response.status}: ${errorData}`);
      }

      const data = await response.json() as { result?: string; outputs?: unknown[]; error?: string; success?: boolean };
      console.log("[AgentChat] API response data:", data);

      // Check if there was an error in execution
      if (data.error) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: Role.Assistant,
          content: `Error: ${data.error}`,
          timestamp: new Date(),
          outputs: [],
        };
        setMessages((prev) => [...prev, errorMessage]);
        toast.error("Code execution failed");
        return;
      }

      // Transform outputs to match Output type if they exist
      const transformedOutputs: Output[] = Array.isArray(data.outputs)
        ? data.outputs.map((output: unknown, index: number): Output => {
            if (output && typeof output === "object") {
              const outputObj = output as InterpreterOutput;
              const image = getImageParts(outputObj);
              if (image) {
                return {
                  id: `output-${index}`,
                  type: OutputType.Image,
                  data: `data:image/${image.format};base64,${image.data}`,
                };
              }
              return {
                id: `output-${index}`,
                type: OutputType.Text,
                data: getTextOutput(outputObj, output),
              };
            }
            return {
              id: `output-${index}`,
              type: OutputType.Text,
              data: String(output),
            };
          })
        : [];

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.Assistant,
        content: data.result || "Command executed successfully",
        timestamp: new Date(),
        outputs: transformedOutputs,
      };

      setMessages((prev) => [...prev, assistantMessage]);
      
      if (data.success !== false) {
        toast.success("Message sent successfully");
      }
    } catch (error) {
      console.error("[AgentChat] Error:", error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: Role.Assistant,
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
        outputs: [],
      };
      
      setMessages((prev) => [...prev, errorMessage]);
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isUser = message.role === Role.User;
          const cardClass = isUser
            ? "ml-auto max-w-[80%] bg-blue-50"
            : "mr-auto max-w-[80%] bg-gray-50";
          const authorLabel = isUser ? "You" : "AI Agent";
          const { outputs } = message;
          const hasOutputs = outputs.length > 0;

          return (
            <Card key={message.id} className={`p-4 ${cardClass}`}>
              <div className="font-semibold text-sm mb-2">{authorLabel}</div>
              <div className="whitespace-pre-wrap">{message.content}</div>

              {/* Render code execution outputs */}
              {hasOutputs && (
                <div className="mt-4 space-y-2">
                  {outputs.map((output, idx) => (
                    <div
                      key={output.id ?? `${message.id}-${output.type}-${idx}`}
                      className="bg-gray-100 p-2 rounded"
                    >
                      {output.type === OutputType.Image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={output.data}
                          alt="Generated output"
                          className="max-w-full"
                        />
                      )}
                      {output.type === OutputType.Text && (
                        <pre className="text-sm">{output.data}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-gray-500 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="flex gap-2 items-center">
          {/* File upload */}
          <input
            id="agent-file-upload"
            type="file"
            className="hidden"
            multiple
            aria-label="Upload files for AI context"
            title="Upload files for AI context"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              const inputEl = e.currentTarget;
              const { files } = inputEl;
              if (files && files.length > 0) {
                handleFileUpload(files);
                // Clear the input so the same file can be selected again if needed
                inputEl.value = "";
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              document.getElementById("agent-file-upload")?.click()
            }
          >
            Upload
          </Button>
          <Input
            value={input}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setInput(e.target.value)
            }
            placeholder="Ask me to run code, analyze data, or help with tasks..."
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              // Avoid submitting while composing with IME
              if (e.nativeEvent.isComposing) return;
              if (e.key !== "Enter") return;
              if (isLoading) return;
              sendMessage();
            }}
            disabled={isLoading}
          />
          <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
            {isLoading ? "Thinking..." : "Send"}
          </Button>
        </div>
        {uploadedFiles.length > 0 && (
          <div className="text-xs text-muted-foreground mt-2">
            {uploadedFiles.length} file{uploadedFiles.length > 1 ? "s" : ""}{" "}
            attached
          </div>
        )}
      </div>
    </div>
  );
}
