'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'react-hot-toast';

type Output =
  | { id?: string; type: 'text'; data: string }
  | { id?: string; type: 'image'; data: string };

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  outputs?: Output[];
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const handleFileUpload = async (files: FileList) => {
    // Implement file upload to agent context
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('files', file));

    try {
      const response = await fetch('/api/agent/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        setUploadedFiles(prev => [...prev, ...Array.from(files)]);
        toast.success('Files uploaded successfully');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload files');
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/agent/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          code: input, // For code execution
          language: 'python'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.result || 'No response',
        timestamp: new Date(),
        outputs: data.outputs
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Chat error:', error);
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] w-full max-w-4xl mx-auto">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <Card key={message.id} className={`p-4 ${
            message.role === 'user'
              ? 'ml-auto max-w-[80%] bg-blue-50'
              : 'mr-auto max-w-[80%] bg-gray-50'
          }`}>
            <div className="font-semibold text-sm mb-2">
              {message.role === 'user' ? 'You' : 'AI Agent'}
            </div>
            <div className="whitespace-pre-wrap">{message.content}</div>

            {/* Render code execution outputs */}
            {message.outputs && message.outputs.length > 0 && (
              <div className="mt-4 space-y-2">
                {message.outputs.map((output, idx) => (
                  <div key={output.id ?? `${message.id}-${output.type}-${idx}`}
                       className="bg-gray-100 p-2 rounded">
                    {output.type === 'image' && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={output.data} alt="Generated output" className="max-w-full" />
                    )}
                    {output.type === 'text' && (
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
        ))}
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
            onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => document.getElementById('agent-file-upload')?.click()}
          >
            Upload
          </Button>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me to run code, analyze data, or help with tasks..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLoading) {
                sendMessage();
              }
            }}
            disabled={isLoading}
          />
          <Button onClick={sendMessage} disabled={isLoading || !input.trim()}>
            {isLoading ? 'Thinking...' : 'Send'}
          </Button>
        </div>
        {uploadedFiles.length > 0 && (
          <div className="text-xs text-muted-foreground mt-2">
            {uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''} attached
          </div>
        )}
      </div>
    </div>
  );
}
