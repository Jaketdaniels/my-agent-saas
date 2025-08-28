"use client";

import { useState, useCallback } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useWebSocket, WebSocketState, type WebSocketMessage } from "@/lib/websocket/client";

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
  System = "system",
}

interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: Date;
  outputs: Output[];
  userId?: string;
}

export function RealtimeChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<string[]>([]);

  // WebSocket connection
  const { 
    state: wsState, 
    sendMessage: sendWsMessage,
    isConnected 
  } = useWebSocket({
    room: 'agent-chat',
    onMessage: (message: WebSocketMessage) => {
      handleWebSocketMessage(message);
    },
    onOpen: () => {
      toast.success('Connected to real-time chat');
    },
    onClose: () => {
      toast.info('Disconnected from real-time chat');
    },
    onError: () => {
      toast.error('WebSocket connection error');
    }
  });

  const handleWebSocketMessage = useCallback((wsMessage: WebSocketMessage) => {
    switch (wsMessage.type) {
      case 'welcome':
        // Handle welcome message with connected clients
        const welcomeData = wsMessage.data as { connectedClients?: string[] };
        if (welcomeData.connectedClients) {
          setConnectedUsers(welcomeData.connectedClients);
        }
        break;

      case 'join':
        // User joined
        if (wsMessage.userId) {
          setConnectedUsers(prev => [...prev, wsMessage.userId!]);
          const joinMessage: Message = {
            id: `system-${Date.now()}`,
            role: Role.System,
            content: `User ${wsMessage.userId} joined the chat`,
            timestamp: new Date(wsMessage.timestamp),
            outputs: [],
          };
          setMessages(prev => [...prev, joinMessage]);
        }
        break;

      case 'leave':
        // User left
        if (wsMessage.userId) {
          setConnectedUsers(prev => prev.filter(id => id !== wsMessage.userId));
          const leaveMessage: Message = {
            id: `system-${Date.now()}`,
            role: Role.System,
            content: `User ${wsMessage.userId} left the chat`,
            timestamp: new Date(wsMessage.timestamp),
            outputs: [],
          };
          setMessages(prev => [...prev, leaveMessage]);
        }
        break;

      case 'message':
        // Regular message from another user
        if (wsMessage.data && typeof wsMessage.data === 'object') {
          const msgData = wsMessage.data as { content?: string; outputs?: Output[] };
          if (msgData.content) {
            const message: Message = {
              id: `msg-${wsMessage.timestamp}`,
              role: Role.User,
              content: msgData.content,
              timestamp: new Date(wsMessage.timestamp),
              outputs: msgData.outputs || [],
              userId: wsMessage.userId,
            };
            setMessages(prev => [...prev, message]);
          }
        }
        break;

      case 'agent-response':
        // Real-time agent response
        if (wsMessage.data && typeof wsMessage.data === 'object') {
          const responseData = wsMessage.data as { content?: string; outputs?: Output[] };
          if (responseData.content) {
            const assistantMessage: Message = {
              id: `agent-${wsMessage.timestamp}`,
              role: Role.Assistant,
              content: responseData.content,
              timestamp: new Date(wsMessage.timestamp),
              outputs: responseData.outputs || [],
            };
            setMessages(prev => [...prev, assistantMessage]);
          }
        }
        break;
    }
  }, []);

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
    
    // Send via WebSocket for real-time broadcast
    if (isConnected) {
      sendWsMessage({
        type: 'message',
        data: {
          content: input,
          outputs: [],
        },
        timestamp: Date.now(),
      });
    }

    setInput("");
    setIsLoading(true);

    // Check if the message contains code blocks for streaming execution
    const isCodeExecution = input.includes("```") || input.toLowerCase().includes("run") || input.toLowerCase().includes("execute");
    
    try {
      if (isCodeExecution) {
        // Use streaming endpoint for code execution
        console.log("[RealtimeChat] Using streaming endpoint for code execution");
        
        const response = await fetch("/api/agent/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: input,
            code: input.replace(/```[a-z]*\n?/g, "").replace(/```/g, ""),
            language: "python",
          }),
        });

        if (!response.ok) {
          throw new Error(`Stream API returned ${response.status}`);
        }

        // Create assistant message that will be updated with streaming content
        const assistantMessageId = (Date.now() + 1).toString();
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: Role.Assistant,
          content: "",
          timestamp: new Date(),
          outputs: [],
        };
        
        setMessages((prev) => [...prev, assistantMessage]);

        // Process the stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let outputContent = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  if (data.type === "output" || data.type === "error_output") {
                    outputContent += data.content;
                    // Update the message with accumulated output
                    setMessages((prev) => 
                      prev.map((msg) => 
                        msg.id === assistantMessageId 
                          ? { 
                              ...msg, 
                              content: outputContent,
                              outputs: [{
                                type: OutputType.Text,
                                data: outputContent
                              }]
                            }
                          : msg
                      )
                    );

                    // Broadcast agent response via WebSocket
                    if (isConnected) {
                      sendWsMessage({
                        type: 'agent-response',
                        data: {
                          content: outputContent,
                          outputs: [{
                            type: OutputType.Text,
                            data: outputContent
                          }]
                        },
                        timestamp: Date.now(),
                      });
                    }
                  } else if (data.type === "result") {
                    // Final result
                    const finalContent = outputContent || data.content || "Execution completed";
                    setMessages((prev) => 
                      prev.map((msg) => 
                        msg.id === assistantMessageId 
                          ? { 
                              ...msg, 
                              content: finalContent,
                              outputs: [{
                                type: OutputType.Text,
                                data: outputContent || data.content
                              }]
                            }
                          : msg
                      )
                    );
                  } else if (data.type === "error") {
                    toast.error("Execution error: " + data.message);
                    setMessages((prev) => 
                      prev.map((msg) => 
                        msg.id === assistantMessageId 
                          ? { ...msg, content: `Error: ${data.message}` }
                          : msg
                      )
                    );
                  }
                } catch (e) {
                  console.error("Failed to parse SSE data:", e);
                }
              }
            }
          }
        }

        toast.success("Code executed successfully");
      } else {
        // Use regular interpret endpoint for non-code messages
        const response = await fetch("/api/agent/interpret", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: input,
            code: input,
            language: "python",
          }),
        });

        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json() as { result?: string; outputs?: Output[]; error?: string; success?: boolean };
        
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: Role.Assistant,
          content: data.result || "Command executed successfully",
          timestamp: new Date(),
          outputs: data.outputs || [],
        };

        setMessages((prev) => [...prev, assistantMessage]);
        
        // Broadcast agent response via WebSocket
        if (isConnected) {
          sendWsMessage({
            type: 'agent-response',
            data: {
              content: assistantMessage.content,
              outputs: assistantMessage.outputs,
            },
            timestamp: Date.now(),
          });
        }
        
        toast.success("Message sent successfully");
      }
    } catch (error) {
      console.error("[RealtimeChat] Error:", error);
      
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

  // Connection status indicator
  const getConnectionStatus = () => {
    switch (wsState) {
      case WebSocketState.CONNECTING:
        return { text: "Connecting...", color: "bg-yellow-500" };
      case WebSocketState.OPEN:
        return { text: "Connected", color: "bg-green-500" };
      case WebSocketState.CLOSING:
        return { text: "Disconnecting...", color: "bg-orange-500" };
      case WebSocketState.CLOSED:
        return { text: "Disconnected", color: "bg-red-500" };
      default:
        return { text: "Unknown", color: "bg-gray-500" };
    }
  };

  const status = getConnectionStatus();

  return (
    <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto">
      {/* Status Bar */}
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status.color}`} />
          <span className="text-sm text-muted-foreground">{status.text}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {connectedUsers.length} user{connectedUsers.length !== 1 ? 's' : ''} online
          </Badge>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => {
          const isUser = message.role === Role.User;
          const isSystem = message.role === Role.System;
          const cardClass = isSystem
            ? "mx-auto max-w-[80%] bg-gray-100 text-center italic"
            : isUser
            ? "ml-auto max-w-[80%] bg-blue-50"
            : "mr-auto max-w-[80%] bg-gray-50";
          
          let authorLabel = "AI Agent";
          if (isUser) {
            authorLabel = message.userId ? `User ${message.userId}` : "You";
          } else if (isSystem) {
            authorLabel = "System";
          }

          const { outputs } = message;
          const hasOutputs = outputs.length > 0;

          return (
            <Card key={message.id} className={`p-4 ${cardClass}`}>
              {!isSystem && (
                <div className="font-semibold text-sm mb-2">{authorLabel}</div>
              )}
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

              {!isSystem && (
                <div className="text-xs text-gray-500 mt-2">
                  {message.timestamp.toLocaleTimeString()}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="border-t p-4">
        <div className="flex gap-2 items-center">
          <Input
            value={input}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setInput(e.target.value)
            }
            placeholder="Ask me to run code, analyze data, or help with tasks..."
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key !== "Enter") return;
              if (isLoading) return;
              sendMessage();
            }}
            disabled={isLoading || !isConnected}
          />
          <Button 
            onClick={sendMessage} 
            disabled={isLoading || !input.trim() || !isConnected}
          >
            {isLoading ? "Thinking..." : "Send"}
          </Button>
        </div>
        {!isConnected && (
          <div className="text-xs text-red-500 mt-2">
            WebSocket disconnected. Messages will be sent via HTTP only.
          </div>
        )}
      </div>
    </div>
  );
}