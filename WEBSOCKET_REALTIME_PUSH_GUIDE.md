# WebSocket实时推送完整指南

## 📋 目录

1. [系统架构](#系统架构)
2. [技术选型](#技术选型)
3. [服务器实现](#服务器实现)
4. [客户端实现](#客户端实现)
5. [前端集成](#前端集成)
6. [性能优化](#性能优化)
7. [故障排查](#故障排查)

---

## 🏗️ 系统架构

### 整体流程

```
树莓派 (边缘计算)
    ↓
采集声音 (麦克风阵列)
    ↓
YAMNet推理 (0-200ms)
    ↓
生成推理结果
    ↓
WebSocket客户端连接
    ↓
实时推送到云端 (毫秒级)
    ↓
云端WebSocket服务器接收
    ↓
广播给所有连接的管家
    ↓
管家端实时显示 (毫秒级)
    ↓
管家采取行动
```

### 架构对比

| 方案 | 延迟 | 成本 | 复杂度 | 适用场景 |
|------|------|------|--------|---------|
| **HTTP轮询** | 5-10秒 | 低 | 低 | 非实时应用 |
| **HTTP长连接** | 2-5秒 | 中 | 中 | 准实时应用 |
| **WebSocket** | 100-500ms | 中 | 高 | 实时应用 ⭐ |

---

## 🔧 技术选型

### 服务器端

**框架**：Express.js + ws (Node.js WebSocket库)

**优点**：
- 轻量级，易于集成到现有Express服务器
- 支持自定义消息格式
- 完整的连接管理和错误处理
- 支持房间（room）概念，便于消息分组

**替代方案**：
- Socket.io - 功能更完整，但更重
- ws - 原生WebSocket，更轻量

### 客户端（树莓派）

**框架**：websocket-client (Python)

**优点**：
- 轻量级，适合树莓派
- 支持自动重连
- 支持SSL/TLS加密
- 易于与YAMNet集成

### 前端

**框架**：React Hook + useEffect

**优点**：
- 原生WebSocket API，无需额外库
- 支持自动重连
- 支持消息队列和缓存

---

## 🖥️ 服务器实现

### 第1步：安装依赖

```bash
cd /home/ubuntu/elderly_safety_monitor
npm install ws
npm install @types/ws --save-dev
```

### 第2步：创建WebSocket服务器

```typescript
// server/_core/websocket.ts

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface ClientConnection {
  ws: WebSocket;
  deviceId: string;
  elderlyId: string;
  connectedAt: Date;
  lastHeartbeat: Date;
}

class WebSocketManager {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private rooms: Map<string, Set<string>> = new Map(); // elderlyId -> deviceIds

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupHandlers();
    this.startHeartbeat();
  }

  private setupHandlers() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      console.log(`[WebSocket] 新连接: ${clientId}`);

      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
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

      ws.on('error', (error) => {
        console.error(`[WebSocket] 连接错误: ${error}`);
      });
    });
  }

  private handleMessage(clientId: string, message: any, ws: WebSocket) {
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

  private handleRegister(clientId: string, message: any, ws: WebSocket) {
    const { deviceId, elderlyId, deviceToken } = message;

    // 验证设备令牌（应该从数据库验证）
    if (!deviceToken) {
      ws.send(JSON.stringify({
        type: 'error',
        message: '设备令牌无效'
      }));
      ws.close();
      return;
    }

    // 注册客户端
    const client: ClientConnection = {
      ws,
      deviceId,
      elderlyId,
      connectedAt: new Date(),
      lastHeartbeat: new Date()
    };

    this.clients.set(clientId, client);

    // 添加到房间
    if (!this.rooms.has(elderlyId)) {
      this.rooms.set(elderlyId, new Set());
    }
    this.rooms.get(elderlyId)!.add(clientId);

    console.log(`[WebSocket] 设备注册成功: ${deviceId} -> ${elderlyId}`);

    ws.send(JSON.stringify({
      type: 'registered',
      clientId,
      message: '注册成功'
    }));
  }

  private handleInference(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`[WebSocket] 客户端不存在: ${clientId}`);
      return;
    }

    const { inference, timestamp } = message;

    // 广播给该老人的所有管家
    const room = this.rooms.get(client.elderlyId);
    if (room) {
      const broadcastMessage = {
        type: 'inference',
        deviceId: client.deviceId,
        elderlyId: client.elderlyId,
        inference,
        timestamp: timestamp || new Date().getTime(),
        receivedAt: new Date().getTime()
      };

      room.forEach(id => {
        const targetClient = this.clients.get(id);
        if (targetClient && targetClient.ws.readyState === WebSocket.OPEN) {
          targetClient.ws.send(JSON.stringify(broadcastMessage));
        }
      });
    }
  }

  private handleHeartbeat(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastHeartbeat = new Date();
      client.ws.send(JSON.stringify({
        type: 'heartbeat_ack',
        timestamp: new Date().getTime()
      }));
    }
  }

  private handleDisconnect(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`[WebSocket] 客户端断开: ${client.deviceId}`);

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

  private startHeartbeat() {
    setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().getTime()
          }));
        }
      });
    }, 30000); // 每30秒发送一次心跳
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public getStats() {
    return {
      totalConnections: this.clients.size,
      totalRooms: this.rooms.size,
      clients: Array.from(this.clients.values()).map(c => ({
        deviceId: c.deviceId,
        elderlyId: c.elderlyId,
        connectedAt: c.connectedAt,
        lastHeartbeat: c.lastHeartbeat
      }))
    };
  }
}

export { WebSocketManager };
```

### 第3步：集成到Express服务器

```typescript
// server/_core/index.ts (或主服务器文件)

import { WebSocketManager } from './websocket';

// 在Express服务器创建后
const server = createServer(app);
const wsManager = new WebSocketManager(server);

// 导出WebSocket管理器供其他模块使用
export { wsManager };

// 添加WebSocket统计API
app.get('/api/ws/stats', (req, res) => {
  res.json(wsManager.getStats());
});
```

---

## 📱 客户端实现（树莓派）

### 第1步：安装依赖

```bash
pip install websocket-client
```

### 第2步：创建WebSocket客户端

```python
# raspberry_pi_websocket_client.py

import websocket
import json
import threading
import time
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class YAMNetWebSocketClient:
    def __init__(self, server_url, device_id, elderly_id, device_token):
        self.server_url = server_url
        self.device_id = device_id
        self.elderly_id = elderly_id
        self.device_token = device_token
        self.ws = None
        self.connected = False
        self.reconnect_count = 0
        self.max_reconnect_attempts = 5
        self.reconnect_delay = 5

    def connect(self):
        """连接到WebSocket服务器"""
        try:
            logger.info(f"[WebSocket] 正在连接到 {self.server_url}")
            
            self.ws = websocket.WebSocketApp(
                self.server_url,
                on_open=self.on_open,
                on_message=self.on_message,
                on_error=self.on_error,
                on_close=self.on_close
            )

            # 在后台线程中运行WebSocket
            wst = threading.Thread(target=self.ws.run_forever)
            wst.daemon = True
            wst.start()

        except Exception as e:
            logger.error(f"[WebSocket] 连接失败: {e}")
            self.reconnect()

    def on_open(self, ws):
        """WebSocket连接打开时调用"""
        logger.info("[WebSocket] 连接已打开")
        self.connected = True
        self.reconnect_count = 0

        # 发送注册消息
        register_msg = {
            'type': 'register',
            'deviceId': self.device_id,
            'elderlyId': self.elderly_id,
            'deviceToken': self.device_token
        }
        ws.send(json.dumps(register_msg))

        # 启动心跳线程
        threading.Thread(target=self.heartbeat_loop, daemon=True).start()

    def on_message(self, ws, message):
        """接收到消息时调用"""
        try:
            data = json.loads(message)
            msg_type = data.get('type')

            if msg_type == 'registered':
                logger.info(f"[WebSocket] 设备已注册: {data.get('clientId')}")
            elif msg_type == 'heartbeat':
                # 响应心跳
                heartbeat_ack = {
                    'type': 'heartbeat_ack',
                    'timestamp': int(time.time() * 1000)
                }
                ws.send(json.dumps(heartbeat_ack))
            elif msg_type == 'error':
                logger.error(f"[WebSocket] 服务器错误: {data.get('message')}")

        except Exception as e:
            logger.error(f"[WebSocket] 消息处理错误: {e}")

    def on_error(self, ws, error):
        """发生错误时调用"""
        logger.error(f"[WebSocket] 错误: {error}")

    def on_close(self, ws, close_status_code, close_msg):
        """连接关闭时调用"""
        logger.warning(f"[WebSocket] 连接已关闭: {close_msg}")
        self.connected = False
        self.reconnect()

    def send_inference(self, inference_results):
        """发送YAMNet推理结果"""
        if not self.connected or not self.ws:
            logger.warning("[WebSocket] 未连接，无法发送数据")
            return False

        try:
            message = {
                'type': 'inference',
                'inference': inference_results,
                'timestamp': int(time.time() * 1000)
            }
            self.ws.send(json.dumps(message))
            logger.info(f"[WebSocket] 推理结果已发送: {inference_results[0]['class_name']}")
            return True

        except Exception as e:
            logger.error(f"[WebSocket] 发送失败: {e}")
            return False

    def heartbeat_loop(self):
        """定期发送心跳"""
        while self.connected:
            try:
                heartbeat_msg = {
                    'type': 'heartbeat',
                    'timestamp': int(time.time() * 1000)
                }
                self.ws.send(json.dumps(heartbeat_msg))
                time.sleep(30)  # 每30秒发送一次心跳
            except Exception as e:
                logger.error(f"[WebSocket] 心跳发送失败: {e}")
                break

    def reconnect(self):
        """重新连接"""
        if self.reconnect_count < self.max_reconnect_attempts:
            self.reconnect_count += 1
            logger.info(f"[WebSocket] 将在{self.reconnect_delay}秒后重新连接 (尝试 {self.reconnect_count}/{self.max_reconnect_attempts})")
            time.sleep(self.reconnect_delay)
            self.connect()
        else:
            logger.error("[WebSocket] 超过最大重连次数，放弃重连")

    def close(self):
        """关闭连接"""
        if self.ws:
            self.ws.close()
            self.connected = False
            logger.info("[WebSocket] 连接已关闭")


# 使用示例
if __name__ == "__main__":
    # 配置
    SERVER_URL = "wss://your-domain.manus.space/ws"  # 使用wss表示安全连接
    DEVICE_ID = "raspberry_pi_001"
    ELDERLY_ID = "elder_001"
    DEVICE_TOKEN = "your_device_token"

    # 创建客户端
    client = YAMNetWebSocketClient(SERVER_URL, DEVICE_ID, ELDERLY_ID, DEVICE_TOKEN)
    client.connect()

    # 模拟发送推理结果
    try:
        while True:
            # 这里应该是从YAMNet获取的实际推理结果
            inference_results = [
                {
                    'class_id': 123,
                    'class_name': '尖叫',
                    'confidence': 0.92,
                    'event_type': 'danger'
                }
            ]
            
            client.send_inference(inference_results)
            time.sleep(10)  # 每10秒发送一次

    except KeyboardInterrupt:
        logger.info("程序已停止")
        client.close()
```

---

## 🎨 前端集成

### 第1步：创建WebSocket Hook

```typescript
// client/src/hooks/useWebSocket.ts

import { useEffect, useRef, useCallback, useState } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket(url: string, onMessage?: (data: any) => void) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[WebSocket] 已连接');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        onMessage?.(data);
      } catch (error) {
        console.error('[WebSocket] 消息解析错误:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] 错误:', error);
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('[WebSocket] 已断开');
      setIsConnected(false);
    };

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [url, onMessage]);

  const send = useCallback((message: WebSocketMessage) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { isConnected, lastMessage, send };
}
```

### 第2步：在组件中使用

```typescript
// client/src/components/RealtimeInferenceMonitor.tsx

import { useWebSocket } from '@/hooks/useWebSocket';
import { useEffect, useState } from 'react';

export function RealtimeInferenceMonitor({ elderlyId }: { elderlyId: string }) {
  const [inferences, setInferences] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalCount: 0,
    lastUpdate: new Date(),
    connectionStatus: 'disconnected'
  });

  const { isConnected, lastMessage } = useWebSocket(
    `wss://your-domain.manus.space/ws`,
    (data) => {
      if (data.type === 'inference' && data.elderlyId === elderlyId) {
        // 添加新推理结果
        setInferences(prev => [data, ...prev].slice(0, 50)); // 保留最近50条

        // 更新统计
        setStats(prev => ({
          ...prev,
          totalCount: prev.totalCount + 1,
          lastUpdate: new Date()
        }));
      }
    }
  );

  useEffect(() => {
    setStats(prev => ({
      ...prev,
      connectionStatus: isConnected ? 'connected' : 'disconnected'
    }));
  }, [isConnected]);

  return (
    <div className="space-y-4">
      {/* 连接状态 */}
      <div className={`p-4 rounded ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
        <p className="text-sm font-medium">
          {isConnected ? '✓ 实时连接中' : '✗ 连接已断开'}
        </p>
      </div>

      {/* 统计信息 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-blue-50 rounded">
          <p className="text-2xl font-bold">{stats.totalCount}</p>
          <p className="text-sm text-gray-600">总推理数</p>
        </div>
        <div className="p-4 bg-green-50 rounded">
          <p className="text-sm text-gray-600">最后更新</p>
          <p className="text-sm font-mono">{stats.lastUpdate.toLocaleTimeString()}</p>
        </div>
      </div>

      {/* 推理结果列表 */}
      <div className="space-y-2">
        {inferences.map((inf, idx) => (
          <div key={idx} className="p-3 bg-gray-50 rounded border-l-4 border-blue-500">
            <div className="flex justify-between items-center">
              <span className="font-medium">{inf.inference[0]?.class_name}</span>
              <span className="text-sm text-gray-600">
                {(inf.inference[0]?.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(inf.timestamp).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 📊 性能优化

### 1. 消息压缩

```typescript
// 使用消息压缩减少带宽
const compressMessage = (message: any) => {
  const json = JSON.stringify(message);
  // 可以使用 pako 库进行gzip压缩
  return json; // 简化版本
};
```

### 2. 消息队列

```typescript
// 批量发送消息
class MessageQueue {
  private queue: any[] = [];
  private batchSize = 10;
  private flushInterval = 1000; // 1秒

  constructor(private ws: WebSocket) {
    setInterval(() => this.flush(), this.flushInterval);
  }

  add(message: any) {
    this.queue.push(message);
    if (this.queue.length >= this.batchSize) {
      this.flush();
    }
  }

  flush() {
    if (this.queue.length > 0) {
      this.ws.send(JSON.stringify({
        type: 'batch',
        messages: this.queue
      }));
      this.queue = [];
    }
  }
}
```

### 3. 连接池管理

```typescript
// 限制并发连接数
class ConnectionPool {
  private connections: Set<WebSocket> = new Set();
  private maxConnections = 100;

  add(ws: WebSocket) {
    if (this.connections.size < this.maxConnections) {
      this.connections.add(ws);
      return true;
    }
    return false;
  }

  remove(ws: WebSocket) {
    this.connections.delete(ws);
  }

  getStats() {
    return {
      active: this.connections.size,
      max: this.maxConnections
    };
  }
}
```

---

## 🔧 故障排查

### 问题1：WebSocket连接失败

**症状**：客户端无法连接到服务器

**解决方案**：
```bash
# 1. 检查服务器是否运行
curl -i https://your-domain.manus.space/

# 2. 检查WebSocket端口是否开放
telnet your-domain.manus.space 443

# 3. 检查防火墙规则
sudo ufw status
```

### 问题2：消息延迟高

**症状**：消息从树莓派到管家端需要>1秒

**解决方案**：
```typescript
// 监控消息延迟
const latency = receivedAt - timestamp;
if (latency > 1000) {
  console.warn(`高延迟警告: ${latency}ms`);
}
```

### 问题3：连接频繁断开

**症状**：WebSocket连接经常断开

**解决方案**：
```python
# 增加心跳频率和超时时间
self.heartbeat_interval = 15  # 改为15秒
self.heartbeat_timeout = 45   # 改为45秒
```

---

## 📚 相关文档

- [树莓派集成指南](./RASPBERRY_PI_CLOUD_INTEGRATION_GUIDE.md)
- [YAMNet实时分类](./YAMNET_REALTIME_AUDIO_CLASSIFICATION.md)
- [系统架构设计](./ARCHITECTURE_INTEGRATION_SIMPLE.md)

---

**版本**：1.0.0  
**最后更新**：2026年3月13日
