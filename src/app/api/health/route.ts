import { NextResponse } from 'next/server';
import { getDB } from '@/db';
import { sql } from 'drizzle-orm';

// Remove edge runtime - OpenNext doesn't support it in regular API routes
// export const runtime = 'edge';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: boolean; latency?: number; error?: string };
    environment: { status: boolean; mode?: string };
  };
  requestId?: string | null;
}

const startTime = Date.now();

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id');
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Date.now() - startTime,
    checks: {
      database: { status: false },
      environment: { status: true, mode: process.env.NODE_ENV }
    },
    requestId
  };

  // Check database connection
  const dbStart = Date.now();
  try {
    const db = getDB();
    await db.run(sql`SELECT 1 as health`);
    health.checks.database = {
      status: true,
      latency: Date.now() - dbStart
    };
  } catch (error) {
    health.checks.database = {
      status: false,
      latency: Date.now() - dbStart,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    health.status = 'degraded';
  }

  // Determine overall health status
  const criticalChecks = [health.checks.database];
  const hasCriticalFailure = criticalChecks.some(check => !check.status);
  
  if (hasCriticalFailure) {
    health.status = 'unhealthy';
  }

  // Return appropriate status code
  const statusCode = health.status === 'healthy' ? 200 :
                     health.status === 'degraded' ? 200 : // Still return 200 for degraded
                     503; // Service unavailable for unhealthy

  return NextResponse.json(health, { 
    status: statusCode,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'x-health-status': health.status
    }
  });
}