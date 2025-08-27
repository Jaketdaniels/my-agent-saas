import { NextResponse } from 'next/server';

// Remove edge runtime - OpenNext doesn't support it in regular API routes
// export const runtime = 'edge';

/**
 * Readiness probe endpoint for load balancers and orchestrators
 * Returns 200 if the service is ready to accept traffic
 */
export async function GET() {
  // Simple readiness check - can be extended with more checks
  return NextResponse.json(
    { 
      ready: true,
      timestamp: new Date().toISOString()
    },
    { 
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    }
  );
}