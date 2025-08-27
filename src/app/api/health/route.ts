import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { getDB } from '@/db';
import { sql } from 'drizzle-orm';

export const runtime = 'edge';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: boolean; latency?: number; error?: string };
    kv: { status: boolean; latency?: number; error?: string };
    memory: { status: boolean; used?: number; limit?: number };
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
      kv: { status: false },
      memory: { status: true },
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

  // Check KV store
  const kvStart = Date.now();
  try {
    const context = getRequestContext();
    const kv = context?.env?.NEXT_INC_CACHE_KV;
    
    if (kv) {
      // Attempt a simple KV operation
      const testKey = '__health_check__';
      await kv.put(testKey, Date.now().toString(), { expirationTtl: 60 });
      const value = await kv.get(testKey);
      
      health.checks.kv = {
        status: !!value,
        latency: Date.now() - kvStart
      };
    } else {
      health.checks.kv = {
        status: false,
        error: 'KV namespace not available'
      };
      health.status = 'degraded';
    }
  } catch (error) {
    health.checks.kv = {
      status: false,
      latency: Date.now() - kvStart,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    health.status = 'degraded';
  }

  // Check memory usage (approximate for Workers)
  try {
    // Workers have a 128MB memory limit
    const memoryLimit = 128 * 1024 * 1024; // 128MB in bytes
    // This is a rough estimate as Workers don't expose actual memory usage
    health.checks.memory = {
      status: true,
      limit: memoryLimit
    };
  } catch {
    health.checks.memory = {
      status: false
    };
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