# WebSocket实时推送集成完整指南

## 📋 目录

1. [系统架构](#系统架构)
2. [快速开始](#快速开始)
3. [服务器端配置](#服务器端配置)
4. [树莓派客户端配置](#树莓派客户端配置)
5. [前端集成](#前端集成)
6. [测试验证](#测试验证)
7. [故障排查](#故障排查)
8. [性能优化](#性能优化)

---

## 系统架构

### 整体流程

```
树莓派 (YAMNet推理)
    ↓
    ├─ 采集声音 (0ms)
    ├─ YAMNet分析 (0-200ms)
    ├─ 生成推理结果 (200ms)
    └─ WebSocket上传 (立即)
         ↓
    云端WebSocket服务器
         ├─ 接收推理结果
         ├─ 验证和处理
         ├─ 存储到数据库
         └─ 广播给所有管家
              ↓
    管家端浏览器
         ├─ WebSocket连接
         ├─ 实时接收推理结果
         └─ 实时展示和分析
```

### 关键特性

| 特性 | 说明 |
|------|------|
| **低延迟** | 从采集到展示 < 1秒 |
| **自动重连** | 网络断开自动重新连接 |
| **消息队列** | 离线时缓存消息，恢复后自动发送 |
| **心跳检测** | 定期检测连接状态，及时发现断线 |
| **房间管理** | 按老人ID分组，支持多管家同时监听 |
| **统计信息** | 实时统计推理数量、延迟等指标 |

---

## 快速开始

### 第1步：启动云端WebSocket服务器

云端WebSocket服务器已集成到Express应用中，启动时自动运行。

```bash
# 启动云端服务
cd /home/ubuntu/elderly_safety_monitor
pnpm dev

# 输出应包含：
# [WebSocket] WebSocket服务器已初始化
```

### 第2步：在树莓派上运行客户端

```bash
# 在树莓派上执行
python3 raspberry_pi_websocket.py

# 配置环境变量（可选）
export WS_SERVER_URL="wss://your-server.com/ws"
export DEVICE_ID="raspberry_pi_001"
export ELDERLY_ID="elder_001"
export DEVICE_TOKEN="your_device_token"

python3 raspberry_pi_websocket.py
```

### 第3步：在前端展示实时数据

在React组件中使用实时监控组件：

```tsx
import RealtimeInferenceMonitor from '@/components/RealtimeInferenceMonitor';

export function Dashboard() {
  return (
    <RealtimeInferenceMonitor 
      elderlyId="elder_001"
      serverUrl="wss://your-server.com/ws"
    />
  );
}
```

---

## 服务器端配置

### WebSocket服务器集成

WebSocket服务器已在 `server/_core/websocket-server.ts` 中实现。

#### 主要类和方法

```typescript
class WebSocketManager {
  // 初始化WebSocket服务器
  constructor(server: Server)
  
  // 处理客户端消息
  private handleMessage(clientId, message, ws)
  
  // 处理设备注册
  private handleRegister(clientId, message, ws)
  
  // 处理推理结果
  private handleInference(clientId, message)
  
  // 广播给特定房间
  public broadcastToRoom(elderlyId, message): number
  
  // 获取系统统计信息
  public getStats(): object
  
  // 关闭服务器
  public close()
}
```

#### 在Express中集成

```typescript
import { createServer } from 'http';
import WebSocketManager from './websocket-server';

const httpServer = createServer(app);
const wsManager = new WebSocketManager(httpServer);

httpServer.listen(3000, () => {
  console.log('服务器已启动，WebSocket已初始化');
});
```

### 消息格式

#### 注册消息（树莓派 → 服务器）

```json
{
  "type": "register",
  "deviceId": "raspberry_pi_001",
  "elderlyId": "elder_001",
  "deviceToken": "your_device_token"
}
```

#### 推理结果消息（树莓派 → 服务器）

```json
{
  "type": "inference",
  "inference": [
    {
      "class_id": 123,
      "class_name": "尖叫",
      "confidence": 0.85,
      "event_type": "danger"
    }
  ],
  "timestamp": 1710432000000
}
```

#### 广播消息（服务器 → 管家）

```json
{
  "type": "inference",
  "deviceId": "raspberry_pi_001",
  "elderlyId": "elder_001",
  "inference": [...],
  "timestamp": 1710432000000,
  "receivedAt": 1710432000050,
  "latency": 50
}
```

---

## 树莓派客户端配置

### 安装依赖

```bash
# 在树莓派上执行
pip3 install websocket-client

# 或使用requirements.txt
pip3 install -r requirements.txt
```

### 配置文件

创建 `config.yaml`：

```yaml
# WebSocket服务器配置
websocket:
  server_url: "wss://eldersafe-fv6io3sc.manus.space/ws"
  reconnect_delay: 5
  max_reconnect_attempts: 10
  heartbeat_interval: 30

# 设备配置
device:
  device_id: "raspberry_pi_001"
  elderly_id: "elder_001"
  device_token: "your_device_token"

# YAMNet配置
yamnet:
  model_path: "./models/yamnet.tflite"
  class_map_path: "./models/yamnet_class_map.csv"
  confidence_threshold: 0.7

# 日志配置
logging:
  level: "INFO"
  file: "websocket_client.log"
```

### 使用客户端

```python
from raspberry_pi_websocket import YAMNetWebSocketClient

# 创建客户端
client = YAMNetWebSocketClient(
    server_url="wss://your-server.com/ws",
    device_id="raspberry_pi_001",
    elderly_id="elder_001",
    device_token="your_device_token"
)

# 连接
if client.connect():
    print("✓ 已连接")
    
    # 发送推理结果
    inference_results = [
        {
            'class_id': 123,
            'class_name': '尖叫',
            'confidence': 0.85,
            'event_type': 'danger'
        }
    ]
    
    client.send_inference(inference_results)
    
    # 查看统计信息
    client.print_stats()
    
    # 关闭连接
    client.close()
```

---

## 前端集成

### 使用Hook

```typescript
import { useRealtimeInference } from '@/hooks/useRealtimeInference';

function MyComponent() {
  const {
    isConnected,      // 连接状态
    inferences,       // 推理结果列表
    stats,            // 统计信息
    send,             // 发送消息
    register,         // 注册设备
    clearHistory      // 清空历史
  } = useRealtimeInference(
    'wss://your-server.com/ws',
    (message) => {
      // 接收推理结果时调用
      console.log('新推理结果:', message);
    },
    (error) => {
      // 发生错误时调用
      console.error('错误:', error);
    },
    (connected) => {
      // 连接状态改变时调用
      console.log('连接状态:', connected);
    }
  );

  return (
    <div>
      <p>连接状态: {isConnected ? '已连接' : '未连接'}</p>
      <p>推理数: {stats.totalMessages}</p>
      <p>延迟: {stats.latencyMs}ms</p>
    </div>
  );
}
```

### 使用监控组件

```tsx
import RealtimeInferenceMonitor from '@/components/RealtimeInferenceMonitor';

export function Dashboard() {
  return (
    <RealtimeInferenceMonitor 
      elderlyId="elder_001"
      serverUrl="wss://your-server.com/ws"
    />
  );
}
```

### 组件功能

- **连接状态** - 显示WebSocket连接状态
- **实时统计** - 显示推理数量和平均延迟
- **事件统计** - 统计各类事件的出现次数
- **推理结果列表** - 显示最近100条推理结果
- **详细信息** - 显示置信度、延迟、时间戳等

---

## 测试验证

### 服务器端测试

```bash
# 查看WebSocket服务器状态
curl http://localhost:3000/api/websocket/stats

# 输出示例：
{
  "timestamp": 1710432000000,
  "totalConnections": 2,
  "totalRooms": 1,
  "connections": [
    {
      "clientId": "client_1710432000000_abc123",
      "deviceId": "raspberry_pi_001",
      "elderlyId": "elder_001",
      "connectedAt": 1710432000000,
      "isAlive": true
    }
  ],
  "rooms": [
    {
      "elderlyId": "elder_001",
      "clientCount": 2
    }
  ]
}
```

### 树莓派客户端测试

```bash
# 运行演示脚本
python3 raspberry_pi_websocket.py

# 预期输出：
# [2026-03-14 21:00:00] INFO - YAMNet WebSocket客户端启动
# [2026-03-14 21:00:01] INFO - ✓ WebSocket连接已打开
# [2026-03-14 21:00:02] INFO - ✓ 设备已注册: client_1710432000000_abc123
# [2026-03-14 21:00:10] INFO - ✓ 推理结果已发送: 尖叫 (85.0%)
```

### 前端测试

```bash
# 在浏览器控制台查看日志
console.log('[WebSocket] 连接已打开');
console.log('[WebSocket] 推理结果已接收: 尖叫 (85.0%)');
```

---

## 故障排查

### 问题1：树莓派无法连接到服务器

**症状**：`✗ 连接失败`

**解决方案**：

```bash
# 1. 检查网络连接
ping your-server.com

# 2. 检查防火墙设置
sudo ufw allow 443/tcp

# 3. 检查WebSocket服务器是否运行
curl -i https://your-server.com/ws

# 4. 检查SSL证书
openssl s_client -connect your-server.com:443
```

### 问题2：推理结果无法上传

**症状**：`✗ 发送失败`

**解决方案**：

```bash
# 1. 检查连接状态
# 应该看到 "✓ WebSocket连接已打开"

# 2. 查看日志
tail -f websocket_client.log

# 3. 检查消息格式
# 确保推理结果包含必要字段

# 4. 检查认证令牌
export DEVICE_TOKEN="correct_token"
```

### 问题3：前端无法接收实时数据

**症状**：浏览器控制台无日志，`isConnected` 为 false

**解决方案**：

```javascript
// 在浏览器控制台检查
// 1. 检查WebSocket连接
console.log(document.readyState);

// 2. 查看网络请求
// 打开DevTools → Network → WS
// 应该看到 /ws 连接

// 3. 检查服务器URL
// 确保使用正确的 wss:// 协议

// 4. 检查CORS设置
// 确保服务器允许WebSocket连接
```

---

## 性能优化

### 1. 减少消息大小

```python
# 只发送必要的信息
inference_results = [
    {
        'class_id': 123,
        'class_name': '尖叫',
        'confidence': 0.85
        # 移除不必要的字段
    }
]
```

### 2. 批量发送

```python
# 累积多个结果后批量发送
batch_results = []
for i in range(10):
    batch_results.append(inference_result)

client.send_inference(batch_results)
```

### 3. 压缩消息

```javascript
// 在服务器端启用消息压缩
const wss = new WebSocketServer({
  server,
  perMessageDeflate: true
});
```

### 4. 限制历史记录

```typescript
// 前端只保留最近100条记录
setInferences(prev => [message, ...prev].slice(0, 100));
```

### 5. 心跳间隔优化

```python
# 根据网络状况调整心跳间隔
# 稳定网络：30秒
# 不稳定网络：10秒
heartbeat_interval = 30
```

---

## 常见问题

### Q: 如何确保消息不丢失？

A: 系统实现了以下机制：
- 本地消息队列：离线时缓存消息
- 自动重连：网络恢复后自动重新连接
- 消息确认：服务器接收后返回确认

### Q: 支持多少个并发连接？

A: 理论上支持数千个并发连接，但实际取决于：
- 服务器硬件配置
- 网络带宽
- 消息频率

建议在生产环境中进行负载测试。

### Q: 如何实现消息加密？

A: 使用 wss://（WebSocket Secure）协议：
```python
# 树莓派客户端自动使用wss://
client = YAMNetWebSocketClient(
    server_url="wss://your-server.com/ws"
)
```

### Q: 如何监控系统性能？

A: 使用提供的统计接口：
```bash
# 获取服务器统计信息
curl http://localhost:3000/api/websocket/stats

# 获取特定老人的连接信息
curl http://localhost:3000/api/websocket/rooms/elder_001
```

---

## 总结

WebSocket实时推送方案已完整实现，包括：

✅ 云端WebSocket服务器（支持房间、心跳、重连）
✅ 树莓派WebSocket客户端（自动重连、消息队列）
✅ 前端实时监控组件（自动连接、实时展示）
✅ 完整的测试和文档

现在您可以：
1. 在树莓派上运行 `python3 raspberry_pi_websocket.py`
2. 在前端使用 `RealtimeInferenceMonitor` 组件
3. 实时查看YAMNet推理结果

祝您使用愉快！
