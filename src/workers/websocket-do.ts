import { DurableObject } from 'cloudflare:workers';

interface WebSocketMessage {
  type: 'join' | 'leave' | 'message' | 'ping' | 'pong';
  userId?: string;
  data?: unknown;
  timestamp: number;
}

interface Client {
  websocket: WebSocket;
  userId: string;
  lastPing: number;
}

export class WebSocketDO extends DurableObject {
  private clients: Map<string, Client> = new Map();
  private heartbeatInterval?: number;

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    
    // Start heartbeat interval
    this.startHeartbeat();
  }

  private startHeartbeat() {
    // Send ping every 30 seconds, close if no pong in 60 seconds
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, client] of this.clients) {
        if (now - client.lastPing > 60000) {
          // Client hasn't responded in 60 seconds
          console.log(`Closing inactive WebSocket for ${id}`);
          client.websocket.close(1000, 'Connection timeout');
          this.clients.delete(id);
        } else {
          // Send ping
          this.sendToClient(client, {
            type: 'ping',
            timestamp: now
          });
        }
      }
    }, 30000) as unknown as number;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    // Extract user ID from query params or headers
    const userId = url.searchParams.get('userId') || 'anonymous';
    const clientId = crypto.randomUUID();

    // Create WebSocket pair
    const { 0: client, 1: server } = new WebSocketPair();

    // Accept WebSocket connection
    server.accept();

    // Store client
    const clientInfo: Client = {
      websocket: server,
      userId,
      lastPing: Date.now()
    };
    this.clients.set(clientId, clientInfo);

    // Set up event listeners
    server.addEventListener('message', async (event) => {
      try {
        const message = JSON.parse(event.data as string) as WebSocketMessage;
        await this.handleMessage(clientId, message);
      } catch (error) {
        console.error('Error handling message:', error);
        this.sendToClient(clientInfo, {
          type: 'error',
          data: 'Invalid message format',
          timestamp: Date.now()
        });
      }
    });

    server.addEventListener('close', () => {
      console.log(`WebSocket closed for ${clientId}`);
      this.clients.delete(clientId);
      this.broadcast({
        type: 'leave',
        userId,
        timestamp: Date.now()
      }, clientId);
    });

    server.addEventListener('error', (error) => {
      console.error(`WebSocket error for ${clientId}:`, error);
      this.clients.delete(clientId);
    });

    // Notify others about new connection
    this.broadcast({
      type: 'join',
      userId,
      timestamp: Date.now()
    }, clientId);

    // Send welcome message
    this.sendToClient(clientInfo, {
      type: 'welcome',
      data: {
        clientId,
        userId,
        connectedClients: Array.from(this.clients.keys())
      },
      timestamp: Date.now()
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private async handleMessage(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Update last ping time
    client.lastPing = Date.now();

    switch (message.type) {
      case 'ping':
        // Respond with pong
        this.sendToClient(client, {
          type: 'pong',
          timestamp: Date.now()
        });
        break;

      case 'pong':
        // Update last ping time (already done above)
        break;

      case 'message':
        // Broadcast message to all clients
        this.broadcast({
          type: 'message',
          userId: client.userId,
          data: message.data,
          timestamp: Date.now()
        });
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  private sendToClient(client: Client, message: unknown) {
    try {
      if (client.websocket.readyState === WebSocket.OPEN) {
        client.websocket.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error('Error sending to client:', error);
    }
  }

  private broadcast(message: unknown, excludeClientId?: string) {
    const messageStr = JSON.stringify(message);
    
    for (const [id, client] of this.clients) {
      if (id !== excludeClientId && client.websocket.readyState === WebSocket.OPEN) {
        try {
          client.websocket.send(messageStr);
        } catch (error) {
          console.error(`Error broadcasting to ${id}:`, error);
        }
      }
    }
  }

  // Clean up when DO is being destroyed
  async destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Close all connections
    for (const [, client] of this.clients) {
      client.websocket.close(1000, 'Server shutting down');
    }
    
    this.clients.clear();
  }
}