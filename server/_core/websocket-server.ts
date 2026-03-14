import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { IncomingMessage } from 'http';

/**
 * WebSocket客户端连接信息
 */
interface ClientConnection {
  ws: WebSocket;
  clientId: string;
  deviceId: string;
  elderlyId: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  isAlive: boolean;
}

/**
 * WebSocket消息类型定义
 */
interface WebSocketMessage {
  type: 'register' | 'inference' | 'heartbeat' | 'error' | 'registered' | 'heartbeat_ack';
  [key: string]: any;
}

/**
 * WebSocket管理器 - 处理所有WebSocket连接和消息
 */
export class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private rooms: Map<string, Set<string>> = new Map(); // elderlyId -> clientIds
  private messageStats: Map<string, number> = new Map(); // 消息统计
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws',
      perMessageDeflate: false // 禁用压缩以降低延迟
    });

    this.setupHandlers();
    this.startHeartbeat();
    
    console.log('[WebSocket] WebSocket服务器已初始化');
  }

  /**
   * 设置WebSocket事件处理器
   */
  private setupHandlers() {
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      const clientId = this.generateClientId();
      console.log(`[WebSocket] 新连接: ${clientId} from ${req.socket.remoteAddress}`);

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message, ws);
        } catch (error) {
          console.error(`[WebSocket] 消息解析错误: ${error}`);
          ws.send(JSON.stringify({
            type: 'error',
            message: '消息格式错误'
          }));
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      ws.on('error', (error: Error) => {
        console.error(`[WebSocket] 连接错误 ${clientId}: ${error}`);
      });

      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.isAlive = true;
          client.lastHeartbeat = new Date();
        }
      });
    });
  }

  /**
   * 处理客户端消息
   */
  private handleMessage(clientId: string, message: WebSocketMessage, ws: WebSocket) {
    switch (message.type) {
      case 'register':
        this.handleRegister(clientId, message, ws);
        break;
      case 'inference':
        this.handleInference(clientId, message);
        break;
      case 'heartbeat':
        this.handleHeartbeat(clientId);
        break;
      default:
        console.warn(`[WebSocket] 未知消息类型: ${message.type}`);
    }
  }

  /**
   * 处理客户端注册
   */
  private handleRegister(clientId: string, message: WebSocketMessage, ws: WebSocket) {
    const { deviceId, elderlyId, deviceToken } = message;

    // 验证必要字段
    if (!deviceId || !elderlyId || !deviceToken) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '缺少必要字段: deviceId, elderlyId, deviceToken'
      }));
      ws.close();
      return;
    }

    // 注册客户端
    const client: ClientConnection = {
      ws,
      clientId,
      deviceId,
      elderlyId,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      isAlive: true
    };

    this.clients.set(clientId, client);

    // 添加到房间
    if (!this.rooms.has(elderlyId)) {
      this.rooms.set(elderlyId, new Set());
    }
    this.rooms.get(elderlyId)!.add(clientId);

    console.log(`[WebSocket] 设备注册成功: ${deviceId} (${elderlyId})`);

    // 发送注册成功消息
    ws.send(JSON.stringify({
      type: 'registered',
      clientId,
      message: '注册成功',
      timestamp: new Date().getTime()
    }));
  }

  /**
   * 处理推理结果
   */
  private handleInference(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`[WebSocket] 客户端不存在: ${clientId}`);
      return;
    }

    const { inference, timestamp } = message;
    const receivedAt = new Date().getTime();

    // 统计消息
    const key = `${client.elderlyId}_inferences`;
    this.messageStats.set(key, (this.messageStats.get(key) || 0) + 1);

    // 广播给该老人的所有管家
    const room = this.rooms.get(client.elderlyId);
    if (room && room.size > 0) {
      const broadcastMessage: WebSocketMessage = {
        type: 'inference',
        deviceId: client.deviceId,
        elderlyId: client.elderlyId,
        inference,
        timestamp: timestamp || receivedAt,
        receivedAt,
        latency: receivedAt - (timestamp || receivedAt)
      };

      let successCount = 0;
      room.forEach(id => {
        const targetClient = this.clients.get(id);
        if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
          try {
            targetClient.ws.send(JSON.stringify(broadcastMessage));
            successCount++;
          } catch (error) {
            console.error(`[WebSocket] 广播失败: ${error}`);
          }
        }
      });

      if (successCount > 0) {
        const eventName = inference[0]?.class_name || 'unknown';
        const confidence = (inference[0]?.confidence * 100).toFixed(1);
        console.log(`[WebSocket] 推理结果已广播: ${eventName} (${confidence}%) -> ${successCount}个管家`);
      }
    } else {
      console.warn(`[WebSocket] 房间不存在或为空: ${client.elderlyId}`);
    }
  }

  /**
   * 处理心跳
   */
  private handleHeartbeat(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.isAlive = true;
      client.lastHeartbeat = new Date();
      
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify({
          type: 'heartbeat_ack',
          timestamp: new Date().getTime()
        }));
      }
    }
  }

  /**
   * 处理客户端断开连接
   */
  private handleDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`[WebSocket] 客户端断开: ${client.deviceId} (${client.elderlyId})`);

      // 从房间移除
      const room = this.rooms.get(client.elderlyId);
      if (room) {
        room.delete(clientId);
        if (room.size === 0) {
          this.rooms.delete(client.elderlyId);
        }
      }

      this.clients.delete(clientId);
    }
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          if (!client.isAlive) {
            // 连接已死亡，关闭它
            console.warn(`[WebSocket] 心跳超时，关闭连接: ${clientId}`);
            client.ws.terminate();
            this.handleDisconnect(clientId);
            return;
          }

          // 发送ping
          client.isAlive = false;
          client.ws.ping();
        }
      });
    }, 30000); // 每30秒检查一次
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 生成客户端ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取系统统计信息
   */
  public getStats() {
    const stats = {
      timestamp: new Date().getTime(),
      totalConnections: this.clients.size,
      totalRooms: this.rooms.size,
      connections: Array.from(this.clients.values()).map(c => ({
        clientId: c.clientId,
        deviceId: c.deviceId,
        elderlyId: c.elderlyId,
        connectedAt: c.connectedAt.getTime(),
        lastHeartbeat: c.lastHeartbeat.getTime(),
        isAlive: c.isAlive,
        connectionDuration: new Date().getTime() - c.connectedAt.getTime()
      })),
      rooms: Array.from(this.rooms.entries()).map(([elderlyId, clients]) => ({
        elderlyId,
        clientCount: clients.size,
        clients: Array.from(clients)
      })),
      messageStats: Object.fromEntries(this.messageStats)
    };
    return stats;
  }

  /**
   * 获取特定老人的连接信息
   */
  public getRoomInfo(elderlyId: string) {
    const room = this.rooms.get(elderlyId);
    if (!room) {
      return null;
    }

    return {
      elderlyId,
      clientCount: room.size,
      clients: Array.from(room).map(clientId => {
        const client = this.clients.get(clientId);
        return {
          clientId,
          deviceId: client?.deviceId,
          connectedAt: client?.connectedAt,
          lastHeartbeat: client?.lastHeartbeat,
          isAlive: client?.isAlive
        };
      })
    };
  }

  /**
   * 广播消息给特定房间
   */
  public broadcastToRoom(elderlyId: string, message: WebSocketMessage) {
    const room = this.rooms.get(elderlyId);
    if (!room) {
      return 0;
    }

    let count = 0;
    room.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
          count++;
        } catch (error) {
          console.error(`[WebSocket] 广播失败: ${error}`);
        }
      }
    });

    return count;
  }

  /**
   * 关闭WebSocket服务器
   */
  public close() {
    this.stopHeartbeat();
    
    // 关闭所有连接
    this.clients.forEach(client => {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close();
      }
    });

    this.wss.close();
    console.log('[WebSocket] WebSocket服务器已关闭');
  }
}

export default WebSocketManager;
