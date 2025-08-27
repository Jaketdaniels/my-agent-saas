'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    console.error('[Global Error Boundary]', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    });
    
    // Send to monitoring service if configured
    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
      // TODO: Send to monitoring service (e.g., Sentry, LogRocket)
    }
  }, [error]);
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-red-600">Oops!</h1>
          <h2 className="text-2xl font-semibold">Something went wrong</h2>
          <p className="text-gray-600">
            We apologize for the inconvenience. The error has been logged and our team will look into it.
          </p>
        </div>
        
        {process.env.NODE_ENV === 'development' && error.message && (
          <div className="bg-gray-100 rounded-lg p-4 text-left">
            <p className="font-mono text-sm text-gray-800 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="font-mono text-xs text-gray-500 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}
        
        <div className="flex gap-4 justify-center">
          <Button
            onClick={reset}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Try again
          </Button>
          <Button
            onClick={() => window.location.href = '/'}
            variant="outline"
          >
            Go to home
          </Button>
        </div>
      </div>
    </div>
  );
}