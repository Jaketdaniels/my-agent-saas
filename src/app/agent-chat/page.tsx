'use client';

import { useState } from 'react';
import { ChatInterface } from '@/components/AgentChat/ChatInterface';
import { RealtimeChatInterface } from '@/components/AgentChat/RealtimeChatInterface';
import { Button } from '@/components/ui/button';

export default function AgentChatPage() {
  const [useRealtime, setUseRealtime] = useState(false);

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">AI Code Agent</h1>
            <p className="text-gray-600 mt-2">
              Chat with an AI agent that can execute Python code, analyze data, and help with tasks.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Real-time mode:</span>
            <Button
              variant={useRealtime ? "default" : "outline"}
              size="sm"
              onClick={() => setUseRealtime(!useRealtime)}
            >
              {useRealtime ? "Enabled" : "Disabled"}
            </Button>
          </div>
        </div>
      </div>

      {useRealtime ? <RealtimeChatInterface /> : <ChatInterface />}
    </div>
  );
}
