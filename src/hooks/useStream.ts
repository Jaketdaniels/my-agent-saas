'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

export interface StreamData<T = unknown> {
  data: T;
  timestamp: number;
  type?: string;
}

export interface UseStreamOptions {
  autoConnect?: boolean;
  reconnectOnError?: boolean;
  onMessage?: (data: StreamData) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export interface UseStreamReturn<T = unknown> {
  data: StreamData<T>[];
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
  clear: () => void;
}

export function useStream<T = unknown>(
  url: string,
  options: UseStreamOptions = {}
): UseStreamReturn<T> {
  const {
    autoConnect = true,
    reconnectOnError = true,
    onMessage,
    onError,
    onComplete
  } = options;

  const [data, setData] = useState<StreamData<T>[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
    setIsLoading(false);
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    
    disconnect();
    
    setIsLoading(true);
    setError(null);

    try {
      const sse = new EventSource(url);
      eventSourceRef.current = sse;

      sse.onopen = () => {
        if (!mountedRef.current) return;
        setIsConnected(true);
        setIsLoading(false);
        setError(null);
      };

      sse.onmessage = (event) => {
        if (!mountedRef.current) return;
        
        try {
          const parsedData = JSON.parse(event.data);
          const streamData: StreamData<T> = {
            data: parsedData,
            timestamp: Date.now(),
            type: event.type !== 'message' ? event.type : undefined
          };
          
          setData(prev => [...prev, streamData]);
          onMessage?.(streamData);
        } catch (parseError) {
          console.error('Failed to parse stream data:', parseError);
        }
      };

      sse.onerror = () => {
        if (!mountedRef.current) return;
        
        const streamError = new Error('Stream connection error');
        setError(streamError);
        setIsConnected(false);
        setIsLoading(false);
        onError?.(streamError);
        
        if (reconnectOnError && mountedRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, 3000);
        } else {
          disconnect();
        }
      };

      const handleComplete = (event: MessageEvent) => {
        if (event.data === '[DONE]' || event.data === 'done') {
          onComplete?.();
          disconnect();
        }
      };

      sse.addEventListener('done', () => {
        if (!mountedRef.current) return;
        onComplete?.();
        disconnect();
      });

      sse.addEventListener('message', handleComplete);

    } catch (connectionError) {
      const err = connectionError instanceof Error ? connectionError : new Error('Failed to connect to stream');
      setError(err);
      setIsLoading(false);
      onError?.(err);
    }
  }, [url, disconnect, onMessage, onError, onComplete, reconnectOnError]);

  const clear = useCallback(() => {
    setData([]);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    if (autoConnect) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    data,
    isConnected,
    isLoading,
    error,
    connect,
    disconnect,
    clear
  };
}

export function useStreamWithBuffer<T = unknown>(
  url: string,
  bufferSize: number = 100,
  options: UseStreamOptions = {}
): UseStreamReturn<T> {
  const streamReturn = useStream<T>(url, {
    ...options,
    onMessage: (data) => {
      options.onMessage?.(data);
    }
  });

  useEffect(() => {
    if (streamReturn.data.length > bufferSize) {
      const newData = streamReturn.data.slice(-bufferSize);
      streamReturn.clear();
      newData.forEach(item => {
        streamReturn.data.push(item);
      });
    }
  }, [streamReturn.data.length, bufferSize, streamReturn]);

  return streamReturn;
}