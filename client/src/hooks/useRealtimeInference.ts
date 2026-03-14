import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * WebSocket推理消息类型
 */
export interface InferenceMessage {
  type: 'inference' | 'registered' | 'heartbeat' | 'error';
  deviceId?: string;
  elderlyId?: string;
  inference?: Array<{
    class_id: number;
    class_name: string;
    confidence: number;
    event_type: string;
  }>;
  timestamp?: number;
  receivedAt?: number;
  latency?: number;
  clientId?: string;
  message?: string;
}

/**
 * 实时推理Hook - 用于连接WebSocket并接收推理结果
 */
export function useRealtimeInference(
  serverUrl: string,
  onInference?: (message: InferenceMessage) => void,
  onError?: (error: string) => void,
  onStatusChange?: (connected: boolean) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [inferences, setInferences] = useState<InferenceMessage[]>([]);
  const [stats, setStats] = useState({
    totalMessages: 0,
    lastUpdate: new Date(),
    latencyMs: 0
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 连接到WebSocket服务器
   */
  const connect = useCallback(() => {
    try {
      console.log('[WebSocket] 正在连接到', serverUrl);

      const ws = new WebSocket(serverUrl);

      ws.onopen = () => {
        console.log('[WebSocket] 连接已打开');
        setIsConnected(true);
        onStatusChange?.(true);

        // 清除重连超时
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: InferenceMessage = JSON.parse(event.data);

          if (message.type === 'inference') {
            // 处理推理结果
            const latency = message.latency || 0;

            setInferences(prev => [message, ...prev].slice(0, 100)); // 保留最近100条
            setStats(prev => ({
              totalMessages: prev.totalMessages + 1,
              lastUpdate: new Date(),
              latencyMs: latency
            }));

            onInference?.(message);
          } else if (message.type === 'registered') {
            console.log('[WebSocket] 设备已注册:', message.clientId);
          } else if (message.type === 'heartbeat') {
            // 响应心跳
            ws.send(JSON.stringify({
              type: 'heartbeat_ack',
              timestamp: Date.now()
            }));
          } else if (message.type === 'error') {
            console.error('[WebSocket] 服务器错误:', message.message);
            onError?.(message.message || '未知错误');
          }
        } catch (error) {
          console.error('[WebSocket] 消息处理错误:', error);
          onError?.(`消息处理错误: ${error}`);
        }
      };

      ws.onerror = (event) => {
        console.error('[WebSocket] 连接错误:', event);
        onError?.('WebSocket连接错误');
      };

      ws.onclose = () => {
        console.log('[WebSocket] 连接已关闭');
        setIsConnected(false);
        onStatusChange?.(false);

        // 5秒后尝试重新连接
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('[WebSocket] 尝试重新连接...');
          connect();
        }, 5000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[WebSocket] 连接失败:', error);
      onError?.(`连接失败: ${error}`);
    }
  }, [serverUrl, onInference, onError, onStatusChange]);

  /**
   * 发送消息
   */
  const send = useCallback((message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] 未连接，无法发送消息');
    }
  }, []);

  /**
   * 注册设备
   */
  const register = useCallback((deviceId: string, elderlyId: string, deviceToken: string) => {
    send({
      type: 'register',
      deviceId,
      elderlyId,
      deviceToken
    });
  }, [send]);

  /**
   * 清空推理历史
   */
  const clearHistory = useCallback(() => {
    setInferences([]);
  }, []);

  /**
   * 初始化连接
   */
  useEffect(() => {
    connect();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    isConnected,
    inferences,
    stats,
    send,
    register,
    clearHistory
  };
}
