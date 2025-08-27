import { Skeleton } from "@/components/ui/skeleton";

export function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <Skeleton className="h-8 w-8 rounded-full" />}
      <div className={`space-y-2 ${isUser ? 'max-w-[70%]' : 'max-w-[70%]'}`}>
        <Skeleton className="h-4 w-[200px]" />
        <Skeleton className="h-4 w-[250px]" />
        <Skeleton className="h-4 w-[180px]" />
      </div>
      {isUser && <Skeleton className="h-8 w-8 rounded-full" />}
    </div>
  );
}

export function ChatInterfaceSkeleton() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-4">
        <ChatMessageSkeleton />
        <ChatMessageSkeleton isUser={true} />
        <ChatMessageSkeleton />
        <ChatMessageSkeleton isUser={true} />
      </div>
      <div className="border-t p-4">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}