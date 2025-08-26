import { ChatInterface } from '@/components/AgentChat/ChatInterface';
import { requireAuth } from '@/lib/auth'; // Your auth middleware

export default async function AgentChatPage() {
  await requireAuth(); // Protect the route

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">AI Code Agent</h1>
        <p className="text-gray-600 mt-2">
          Chat with an AI agent that can execute Python code, analyze data, and help with tasks.
        </p>
      </div>

      <ChatInterface />
    </div>
  );
}
