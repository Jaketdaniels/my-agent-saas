import { useEffect, useRef, useState, useCallback } from 'react';

export interface WebSocketMessage {
  type: string;
  userId?: string;
  data?: unknown;
  timestamp: number;
}

export interface UseWebSocketOptions {
  room?: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onOpen?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
}

export enum WebSocketState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    room = 'global',
    reconnect = true,
    reconnectInterval = 1000,
    maxReconnectAttempts = 10,
    onMessage,
    onOpen,
    onClose,
    onError,
  } = options;

  const [state, setState] = useState<WebSocketState>(WebSocketState.CLOSED);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const connect = useCallback(() => {
    try {
      // Clean up existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      setState(WebSocketState.CONNECTING);
      setError(null);

      // Construct WebSocket URL
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}/api/ws?room=${encodeURIComponent(room)}`;

      console.log('[WebSocket] Connecting to:', url);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      // Set up event handlers
      ws.onopen = (event) => {
        console.log('[WebSocket] Connected');
        setState(WebSocketState.OPEN);
        reconnectCountRef.current = 0;
        onOpen?.(event);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          console.log('[WebSocket] Message received:', message);
          setLastMessage(message);
          onMessage?.(message);
          
          // Handle ping/pong for heartbeat
          if (message.type === 'ping' && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      ws.onerror = (event) => {
        console.error('[WebSocket] Error:', event);
        const err = new Error('WebSocket error');
        setError(err);
        setState(WebSocketState.CLOSED);
        onError?.(event);
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Closed:', event.code, event.reason);
        setState(WebSocketState.CLOSED);
        wsRef.current = null;
        onClose?.(event);

        // Attempt to reconnect if enabled
        if (
          reconnect &&
          reconnectCountRef.current < maxReconnectAttempts &&
          !event.wasClean
        ) {
          const delay = Math.min(
            reconnectInterval * Math.pow(2, reconnectCountRef.current),
            30000
          );
          
          console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectCountRef.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectCountRef.current++;
            connect();
          }, delay);
        }
      };
    } catch (err) {
      console.error('[WebSocket] Connection failed:', err);
      const error = err instanceof Error ? err : new Error('Failed to connect');
      setError(error);
      setState(WebSocketState.CLOSED);
    }
  }, [room, reconnect, reconnectInterval, maxReconnectAttempts, onMessage, onOpen, onClose, onError]);

  const disconnect = useCallback(() => {
    console.log('[WebSocket] Disconnecting');
    
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    
    // Reset reconnect count
    reconnectCountRef.current = maxReconnectAttempts;
    
    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
    
    setState(WebSocketState.CLOSED);
  }, [maxReconnectAttempts]);

  const sendMessage = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const messageStr = typeof message === 'string' 
        ? message 
        : JSON.stringify(message);
      
      console.log('[WebSocket] Sending message:', messageStr);
      wsRef.current.send(messageStr);
      return true;
    }
    
    console.warn('[WebSocket] Cannot send message - not connected');
    return false;
  }, []);

  // Auto-connect on mount and clean up on unmount
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    state,
    lastMessage,
    error,
    sendMessage,
    connect,
    disconnect,
    isConnected: state === WebSocketState.OPEN,
    isConnecting: state === WebSocketState.CONNECTING,
  };
}