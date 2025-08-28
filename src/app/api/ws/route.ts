import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { requireApiAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const session = await requireApiAuth();
    const userId = session.user.id;

    // Check for WebSocket upgrade
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new NextResponse('Expected WebSocket', { status: 426 });
    }

    // Get Cloudflare context
    const { env } = getCloudflareContext();
    
    // Check if WebSocket DO binding exists
    const envAny = env as unknown as { WEBSOCKET_DO?: DurableObjectNamespace };
    if (!envAny?.WEBSOCKET_DO) {
      console.error('[WebSocket] WEBSOCKET_DO binding not found');
      return NextResponse.json(
        { error: 'WebSocket service not configured' },
        { status: 500 }
      );
    }

    // Get or create a Durable Object instance for this chat room
    // You can use different IDs for different chat rooms/channels
    const roomId = request.nextUrl.searchParams.get('room') || 'global';
    const id = envAny.WEBSOCKET_DO.idFromName(roomId);
    const stub = envAny.WEBSOCKET_DO.get(id);

    // Build the WebSocket URL with user info
    const url = new URL(request.url);
    url.searchParams.set('userId', userId);

    // Forward the WebSocket request to the Durable Object
    const response = await stub.fetch(url, {
      method: 'GET',
      headers: request.headers,
    });

    // Return the WebSocket response
    if (response.status === 101) {
      return response;
    }

    // If not a WebSocket response, return error
    return NextResponse.json(
      { error: 'Failed to establish WebSocket connection' },
      { status: response.status }
    );

  } catch (error) {
    console.error('[WebSocket] Connection error:', error);
    
    // Check if it's an auth error
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to establish WebSocket connection', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Upgrade, Connection',
    },
  });
}