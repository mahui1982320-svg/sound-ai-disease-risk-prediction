# 养老院智能报警管理系统 - API 文档

## 系统概述

本系统采用"边缘检测 + 云端报警"的架构，支持树莓派硬件端上传报警数据，管家端进行人工复核和数据管理。

## 硬件端 API

### 1. 上传报警数据

**端点：** `POST /api/trpc/alarms.upload`

**认证：** 不需要认证（公开接口）

**请求体：**
```json
{
  "elderlyId": 1,
  "eventType": "fall",
  "confidenceScore": 85,
  "audioUrl": "https://oss.example.com/audio/20260121_room101_fall.mp3"
}
```

**参数说明：**
- `elderlyId` (number, 必需)：老人ID
- `eventType` (string, 必需)：事件类型，可选值：`fall`（摔倒）、`scream`（尖叫）、`cough`（咳嗽）、`moan`（呻吟）
- `confidenceScore` (number, 必需)：置信度分数，范围 0-100
- `audioUrl` (string, 必需)：音频文件URL（10秒音频片段）

**响应：**
```json
{
  "success": true
}
```

**错误响应：**
```json
{
  "code": "BAD_REQUEST",
  "message": "置信度必须在 0-100 之间"
}
```

**示例（Python）：**
```python
import requests

def upload_alarm(elderly_id, event_type, confidence, audio_url):
    url = "https://your-app.manus.space/api/trpc/alarms.upload"
    payload = {
        "elderlyId": elderly_id,
        "eventType": event_type,
        "confidenceScore": confidence,
        "audioUrl": audio_url
    }
    response = requests.post(url, json=payload)
    return response.json()

# 使用示例
result = upload_alarm(
    elderly_id=1,
    event_type="fall",
    confidence=85,
    audio_url="https://oss.example.com/audio/alarm_001.mp3"
)
print(result)  # {"success": true}
```

---

## 管家端 API

### 认证

所有管家端API都需要用户认证。系统使用 Manus OAuth 进行认证。

**登录流程：**
1. 用户点击"登录"按钮
2. 重定向到 Manus OAuth 门户
3. 认证成功后，系统自动创建会话
4. 用户可访问所有受保护的API

### 2. 获取当前用户信息

**端点：** `GET /api/trpc/auth.me`

**认证：** 需要

**响应：**
```json
{
  "id": 1,
  "openId": "user_12345",
  "name": "管家张三",
  "email": "zhangsan@example.com",
  "role": "admin",
  "createdAt": "2026-01-20T10:00:00Z",
  "updatedAt": "2026-01-21T08:00:00Z"
}
```

### 3. 获取报警列表

**端点：** `GET /api/trpc/alarms.list`

**认证：** 需要

**查询参数：**
```json
{
  "limit": 50,
  "offset": 0,
  "status": "pending"
}
```

**参数说明：**
- `limit` (number, 可选)：返回数量，默认50
- `offset` (number, 可选)：分页偏移，默认0
- `status` (string, 可选)：筛选状态，可选值：`pending`（待复核）、`confirmed`（已确认）、`falseAlarm`（误报）

**响应：**
```json
[
  {
    "id": 1,
    "elderlyId": 1,
    "eventType": "fall",
    "confidenceScore": 85,
    "audioUrl": "https://oss.example.com/audio/alarm_001.mp3",
    "reviewStatus": "pending",
    "reviewedBy": null,
    "reviewedAt": null,
    "reviewNotes": null,
    "createdAt": "2026-01-21T08:30:00Z",
    "updatedAt": "2026-01-21T08:30:00Z"
  }
]
```

### 4. 复核报警

**端点：** `POST /api/trpc/alarms.review`

**认证：** 需要

**请求体：**
```json
{
  "id": 1,
  "status": "confirmed",
  "notes": "确认老人摔倒，已联系护理员"
}
```

**参数说明：**
- `id` (number, 必需)：报警ID
- `status` (string, 必需)：复核状态，可选值：`confirmed`（确认危险）、`falseAlarm`（标记误报）
- `notes` (string, 可选)：复核备注

**响应：**
```json
{
  "success": true
}
```

### 5. 获取老人列表

**端点：** `GET /api/trpc/elderly.list`

**认证：** 需要

**响应：**
```json
[
  {
    "id": 1,
    "name": "李大爷",
    "roomNumber": "101",
    "emergencyContact": "李女士",
    "emergencyPhone": "13800138000",
    "notes": "有高血压病史",
    "createdAt": "2026-01-20T10:00:00Z",
    "updatedAt": "2026-01-20T10:00:00Z"
  }
]
```

### 6. 创建老人档案

**端点：** `POST /api/trpc/elderly.create`

**认证：** 需要

**请求体：**
```json
{
  "name": "王奶奶",
  "roomNumber": "102",
  "emergencyContact": "王先生",
  "emergencyPhone": "13900139000",
  "notes": "行动不便，需要特别关注"
}
```

**参数说明：**
- `name` (string, 必需)：老人姓名
- `roomNumber` (string, 必需)：房间号
- `emergencyContact` (string, 可选)：紧急联系人
- `emergencyPhone` (string, 可选)：紧急联系电话
- `notes` (string, 可选)：备注

**响应：**
```json
{
  "id": 2,
  "name": "王奶奶",
  "roomNumber": "102",
  "emergencyContact": "王先生",
  "emergencyPhone": "13900139000",
  "notes": "行动不便，需要特别关注",
  "createdAt": "2026-01-21T09:00:00Z",
  "updatedAt": "2026-01-21T09:00:00Z"
}
```

### 7. 更新老人档案

**端点：** `POST /api/trpc/elderly.update`

**认证：** 需要

**请求体：**
```json
{
  "id": 1,
  "name": "李大爷",
  "roomNumber": "101",
  "emergencyContact": "李女士",
  "emergencyPhone": "13800138000",
  "notes": "有高血压病史，最近状态良好"
}
```

**响应：**
```json
{
  "success": true
}
```

### 8. 删除老人档案

**端点：** `POST /api/trpc/elderly.delete`

**认证：** 需要

**请求体：**
```json
{
  "id": 1
}
```

**响应：**
```json
{
  "success": true
}
```

### 9. 获取数据统计

**端点：** `GET /api/trpc/alarms.statistics`

**认证：** 需要

**响应：**
```json
{
  "totalAlarms": 156,
  "confirmedAlarms": 142,
  "falseAlarmCount": 14,
  "falseAlarmRate": 8.97,
  "eventDistribution": {
    "fall": 45,
    "scream": 38,
    "cough": 52,
    "moan": 21
  },
  "trendData": [
    {
      "date": "2026-01-15",
      "count": 5
    },
    {
      "date": "2026-01-16",
      "count": 8
    }
  ]
}
```

### 10. 登出

**端点：** `POST /api/trpc/auth.logout`

**认证：** 需要

**响应：**
```json
{
  "success": true
}
```

---

## 数据库表结构

### elderly（老人档案表）
```sql
CREATE TABLE elderly (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  roomNumber VARCHAR(50) NOT NULL,
  emergencyContact VARCHAR(255),
  emergencyPhone VARCHAR(20),
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### alarm_records（报警记录表）
```sql
CREATE TABLE alarm_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  elderlyId INT NOT NULL,
  eventType ENUM('fall', 'scream', 'cough', 'moan') NOT NULL,
  confidenceScore INT NOT NULL,
  audioUrl VARCHAR(500) NOT NULL,
  reviewStatus ENUM('pending', 'confirmed', 'falseAlarm') DEFAULT 'pending',
  reviewedBy INT,
  reviewedAt TIMESTAMP,
  reviewNotes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (elderlyId) REFERENCES elderly(id)
);
```

### review_logs（复核日志表）
```sql
CREATE TABLE review_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  alarmRecordId INT NOT NULL,
  userId INT NOT NULL,
  action ENUM('confirmed', 'falseAlarm') NOT NULL,
  notes TEXT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alarmRecordId) REFERENCES alarm_records(id)
);
```

---

## 错误处理

所有API错误都遵循以下格式：

```json
{
  "code": "ERROR_CODE",
  "message": "错误描述信息"
}
```

**常见错误码：**
- `UNAUTHORIZED`：未认证或认证失败
- `FORBIDDEN`：权限不足
- `NOT_FOUND`：资源不存在
- `BAD_REQUEST`：请求参数错误
- `INTERNAL_SERVER_ERROR`：服务器内部错误

---

## 集成示例

### Python 硬件端集成

```python
import requests
import json
from datetime import datetime

class AlarmUploader:
    def __init__(self, api_url):
        self.api_url = api_url
    
    def upload_alarm(self, elderly_id, event_type, confidence, audio_url):
        """上传报警数据"""
        payload = {
            "elderlyId": elderly_id,
            "eventType": event_type,
            "confidenceScore": confidence,
            "audioUrl": audio_url
        }
        
        try:
            response = requests.post(
                f"{self.api_url}/api/trpc/alarms.upload",
                json=payload,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"上传失败: {e}")
            return {"success": False, "error": str(e)}

# 使用示例
uploader = AlarmUploader("https://your-app.manus.space")

# 上传摔倒报警
result = uploader.upload_alarm(
    elderly_id=1,
    event_type="fall",
    confidence=85,
    audio_url="https://oss.example.com/audio/fall_001.mp3"
)

print(result)  # {"success": true}
```

### JavaScript 管家端集成

```javascript
import { trpc } from '@/lib/trpc';

// 获取报警列表
const { data: alarms } = trpc.alarms.list.useQuery({
  limit: 50,
  offset: 0,
  status: 'pending'
});

// 复核报警
const reviewMutation = trpc.alarms.review.useMutation({
  onSuccess: () => {
    console.log('复核成功');
  }
});

const handleConfirm = () => {
  reviewMutation.mutate({
    id: 1,
    status: 'confirmed',
    notes: '确认摔倒，已联系护理员'
  });
};
```

---

## 部署说明

### 前置要求
- Node.js 22.13.0+
- MySQL 8.0+
- 树莓派 4B 或 Orange Pi 5（硬件端）

### 环境变量配置

```bash
# 数据库
DATABASE_URL=mysql://user:password@host:3306/elderly_safety

# OAuth
VITE_APP_ID=your_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im

# JWT
JWT_SECRET=your_jwt_secret

# 其他
OWNER_OPEN_ID=your_owner_id
OWNER_NAME=Your Name
```

### 启动应用

```bash
# 安装依赖
pnpm install

# 推送数据库迁移
pnpm db:push

# 开发环境
pnpm dev

# 生产环境
pnpm build
pnpm start
```

---

## 支持与反馈

如有任何问题或建议，请联系开发团队。
