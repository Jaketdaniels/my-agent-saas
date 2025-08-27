'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log critical layout error
    console.error('[Global Layout Error]', {
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      timestamp: new Date().toISOString(),
      critical: true
    });
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '20px'
        }}>
          <div style={{
            maxWidth: '400px',
            textAlign: 'center'
          }}>
            <h1 style={{ 
              fontSize: '2rem', 
              marginBottom: '1rem',
              color: '#dc2626'
            }}>
              Critical Error
            </h1>
            <p style={{ 
              marginBottom: '1.5rem',
              color: '#4b5563'
            }}>
              A critical error occurred in the application layout. 
              Please refresh the page or contact support if the problem persists.
            </p>
            <button
              onClick={reset}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}