# YAMNet集成实现指南

## 概述

本文档详细说明如何在小羊养老声音监控系统中集成Google的YAMNet大模型，用于实时分析硬件采集的生活声音，识别危险事件（跌倒、尖叫、求救等）并触发警报。

---

## 1. YAMNet模型简介

### 什么是YAMNet？

**YAMNet** 是Google开源的音频事件分类模型，基于MobileNet架构，具有以下特点：

- **开源免费** - 在Apache 2.0许可下开源
- **轻量级** - 模型大小仅~4MB，适合边缘计算部署
- **高效** - 推理速度快，可在树莓派等低功耗设备上运行
- **多分类** - 支持521个音频事件分类
- **预训练** - 在AudioSet数据集上预训练，开箱即用

### 支持的音频事件类别

YAMNet支持521个音频事件分类，包括：

| 类别 | 示例事件 |
|------|--------|
| **危险事件** | Fall, Crash, Bang, Scream, Yell, Shout, Cough, Sneeze, Moan, Groan |
| **环境声音** | Door knock, Doorbell, Telephone, Alarm, Siren, Car horn |
| **生活声音** | Footsteps, Breathing, Heartbeat, Typing, Mouse click |
| **其他** | Music, Speech, Silence, Background noise |

---

## 2. 系统架构集成

### 2.1 数据流架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    小羊养老声音监控系统                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────┐  │
│  │  硬件采集    │      │  YAMNet推理  │      │  云端处理    │  │
│  │  (树莓派)    │─────▶│  (边缘计算)  │─────▶│  (服务器)    │  │
│  │              │      │              │      │              │  │
│  │ • 麦克风阵列 │      │ • 521类分类  │      │ • 数据存储   │  │
│  │ • 16kHz采样  │      │ • 置信度评分 │      │ • 警报推送   │  │
│  │ • 24/7监听   │      │ • <200ms推理 │      │ • 人工复核   │  │
│  └──────────────┘      └──────────────┘      └──────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 数据库架构

新增表：`yamnet_inferences`

```sql
CREATE TABLE yamnet_inferences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  alarm_record_id INT NOT NULL,              -- 关联的报警记录
  
  -- YAMNet原始输出
  top_labels TEXT NOT NULL,                  -- [{label, confidence}, ...]
  raw_scores TEXT NOT NULL,                  -- 521个标签的完整分数
  
  -- 处理结果
  mapped_event_type ENUM('fall','scream','cough','moan'),
  mapping_confidence INT,                    -- 0-100
  
  -- 处理元数据
  audio_length INT,                          -- 音频长度(毫秒)
  processing_time INT,                       -- 推理时间(毫秒)
  model_version VARCHAR(50),                 -- YAMNet版本
  
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

---

## 3. API接口

### 3.1 上传音频并进行YAMNet推理

**端点**: `POST /api/trpc/alarms.uploadWithYAMNet`

**请求体**:
```json
{
  "elderlyId": 1,
  "eventType": "fall",
  "confidenceScore": 85,
  "audioUrl": "https://example.com/audio.wav",
  "topLabels": [
    { "label": "fall", "confidence": 0.95 },
    { "label": "crash", "confidence": 0.03 },
    { "label": "bang", "confidence": 0.02 }
  ],
  "rawScores": {
    "label_0": 0.95,
    "label_1": 0.03,
    ...
  },
  "audioLength": 1500,
  "processingTime": 150,
  "modelVersion": "yamnet-v1.0"
}
```

**响应**:
```json
{
  "success": true,
  "alarmId": 123
}
```

### 3.2 获取YAMNet推理详情

**端点**: `GET /api/trpc/alarms.getYAMNetDetails`

**请求参数**:
```json
{
  "alarmId": 123
}
```

**响应**:
```json
{
  "topLabels": [
    { "label": "fall", "confidence": 0.95 },
    { "label": "crash", "confidence": 0.03 }
  ],
  "mappedEventType": "fall",
  "mappingConfidence": 95,
  "processingTime": 150,
  "audioLength": 1500,
  "modelVersion": "yamnet-v1.0"
}
```

### 3.3 获取YAMNet推理统计

**端点**: `GET /api/trpc/alarms.getYAMNetStats`

**响应**:
```json
{
  "totalInferences": 1250,
  "avgProcessingTime": 145,
  "avgAudioLength": 1450,
  "modelVersions": ["yamnet-v1.0"]
}
```

---

## 4. 硬件端集成（树莓派）

### 4.1 环境设置

```bash
# 安装Python依赖
pip install tensorflow numpy sounddevice scipy

# 下载YAMNet模型
wget https://storage.googleapis.com/yamnet/yamnet.tflite
wget https://storage.googleapis.com/yamnet/yamnet_labels.txt
```

### 4.2 音频采集和推理脚本

```python
import numpy as np
import tensorflow as tf
import sounddevice as sd
from scipy import signal
import json
import requests
import time

class YAMNetAudioMonitor:
    def __init__(self, model_path="yamnet.tflite", labels_path="yamnet_labels.txt"):
        # 加载YAMNet模型
        self.interpreter = tf.lite.Interpreter(model_path=model_path)
        self.interpreter.allocate_tensors()
        
        # 加载标签
        with open(labels_path) as f:
            self.labels = [line.strip() for line in f]
        
        # 模型配置
        self.input_details = self.interpreter.get_input_details()
        self.output_details = self.interpreter.get_output_details()
        self.sample_rate = 16000
        
        # 事件映射
        self.event_mapping = {
            'fall': 'fall',
            'crash': 'fall',
            'bang': 'fall',
            'scream': 'scream',
            'yell': 'scream',
            'shout': 'scream',
            'cough': 'cough',
            'sneeze': 'cough',
            'moan': 'moan',
            'groan': 'moan',
        }
        
        self.server_url = "http://localhost:3000/api/trpc/alarms.uploadWithYAMNet"
        self.elderly_id = 1
    
    def process_audio(self, audio_data):
        """处理音频并进行YAMNet推理"""
        start_time = time.time()
        
        # 重采样到16kHz
        if len(audio_data.shape) > 1:
            audio_data = np.mean(audio_data, axis=1)
        
        # 归一化
        audio_data = audio_data.astype(np.float32)
        audio_data = audio_data / np.max(np.abs(audio_data))
        
        # 设置输入
        self.interpreter.set_tensor(
            self.input_details[0]['index'],
            np.expand_dims(audio_data, axis=0)
        )
        
        # 运行推理
        self.interpreter.invoke()
        
        # 获取输出
        scores = self.interpreter.get_tensor(self.output_details[0]['index'])[0]
        
        processing_time = int((time.time() - start_time) * 1000)
        audio_length = int(len(audio_data) / self.sample_rate * 1000)
        
        return scores, processing_time, audio_length
    
    def get_top_events(self, scores, top_k=3, threshold=0.3):
        """获取置信度最高的事件"""
        top_indices = np.argsort(scores)[-top_k:][::-1]
        top_events = []
        
        for idx in top_indices:
            label = self.labels[idx]
            confidence = float(scores[idx])
            
            if confidence > threshold:
                top_events.append({
                    'label': label,
                    'confidence': confidence
                })
        
        return top_events
    
    def map_to_event_type(self, top_events):
        """将YAMNet事件映射到系统事件类型"""
        for event in top_events:
            label = event['label'].lower()
            if label in self.event_mapping:
                event_type = self.event_mapping[label]
                confidence = int(event['confidence'] * 100)
                return event_type, confidence
        
        return None, 0
    
    def send_to_server(self, event_type, confidence, top_events, raw_scores, 
                      audio_length, processing_time):
        """发送推理结果到服务器"""
        payload = {
            "elderlyId": self.elderly_id,
            "eventType": event_type,
            "confidenceScore": confidence,
            "audioUrl": "https://example.com/audio.wav",
            "topLabels": top_events,
            "rawScores": {str(i): float(s) for i, s in enumerate(raw_scores)},
            "audioLength": audio_length,
            "processingTime": processing_time,
            "modelVersion": "yamnet-v1.0"
        }
        
        try:
            response = requests.post(self.server_url, json=payload)
            return response.json()
        except Exception as e:
            print(f"Error sending to server: {e}")
            return None
    
    def run_continuous_monitoring(self, chunk_duration=1.0):
        """连续监听和处理音频"""
        chunk_samples = int(self.sample_rate * chunk_duration)
        
        print(f"开始监听... (采样率: {self.sample_rate}Hz, 块大小: {chunk_duration}s)")
        
        try:
            with sd.InputStream(samplerate=self.sample_rate, channels=1, 
                              blocksize=chunk_samples):
                while True:
                    # 采集音频块
                    audio_chunk, _ = sd.read(chunk_samples)
                    
                    # 进行YAMNet推理
                    scores, processing_time, audio_length = self.process_audio(audio_chunk)
                    
                    # 获取置信度最高的事件
                    top_events = self.get_top_events(scores, top_k=3, threshold=0.3)
                    
                    if top_events:
                        # 映射到系统事件类型
                        event_type, confidence = self.map_to_event_type(top_events)
                        
                        if event_type and confidence > 70:  # 置信度阈值
                            print(f"检测到事件: {event_type} (置信度: {confidence}%)")
                            
                            # 发送到服务器
                            result = self.send_to_server(
                                event_type, confidence, top_events, scores,
                                audio_length, processing_time
                            )
                            
                            if result:
                                print(f"服务器响应: {result}")
        
        except KeyboardInterrupt:
            print("监听已停止")

# 使用示例
if __name__ == "__main__":
    monitor = YAMNetAudioMonitor()
    monitor.run_continuous_monitoring(chunk_duration=1.0)
```

---

## 5. 前端集成

### 5.1 上传YAMNet推理结果

```typescript
import { trpc } from "@/lib/trpc";

export function useYAMNetUpload() {
  const uploadMutation = trpc.alarms.uploadWithYAMNet.useMutation({
    onSuccess: (data) => {
      console.log("推理结果已上传", data);
    },
    onError: (error) => {
      console.error("上传失败", error);
    },
  });

  const uploadYAMNetResult = async (
    elderlyId: number,
    eventType: "fall" | "scream" | "cough" | "moan",
    topLabels: Array<{ label: string; confidence: number }>,
    rawScores: Record<string, number>,
    audioLength: number,
    processingTime: number
  ) => {
    await uploadMutation.mutateAsync({
      elderlyId,
      eventType,
      confidenceScore: Math.round(topLabels[0]?.confidence * 100 || 0),
      audioUrl: "https://example.com/audio.wav",
      topLabels,
      rawScores,
      audioLength,
      processingTime,
      modelVersion: "yamnet-v1.0",
    });
  };

  return { uploadYAMNetResult, isLoading: uploadMutation.isPending };
}
```

### 5.2 查看YAMNet推理详情

```typescript
import { trpc } from "@/lib/trpc";

export function YAMNetDetails({ alarmId }: { alarmId: number }) {
  const { data: details, isLoading } = trpc.alarms.getYAMNetDetails.useQuery({
    alarmId,
  });

  if (isLoading) return <div>加载中...</div>;
  if (!details) return <div>无推理数据</div>;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">事件类型</h3>
        <p>{details.mappedEventType}</p>
      </div>
      
      <div>
        <h3 className="font-semibold">置信度</h3>
        <p>{details.mappingConfidence}%</p>
      </div>
      
      <div>
        <h3 className="font-semibold">处理时间</h3>
        <p>{details.processingTime}ms</p>
      </div>
      
      <div>
        <h3 className="font-semibold">音频长度</h3>
        <p>{details.audioLength}ms</p>
      </div>
      
      <div>
        <h3 className="font-semibold">顶部标签</h3>
        <ul className="space-y-2">
          {details.topLabels.map((label, idx) => (
            <li key={idx} className="flex justify-between">
              <span>{label.label}</span>
              <span>{(label.confidence * 100).toFixed(1)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

### 5.3 YAMNet统计仪表板

```typescript
import { trpc } from "@/lib/trpc";

export function YAMNetStats() {
  const { data: stats } = trpc.alarms.getYAMNetStats.useQuery();

  if (!stats) return <div>加载中...</div>;

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="bg-blue-50 p-4 rounded">
        <h4 className="text-sm text-gray-600">总推理次数</h4>
        <p className="text-2xl font-bold">{stats.totalInferences}</p>
      </div>
      
      <div className="bg-green-50 p-4 rounded">
        <h4 className="text-sm text-gray-600">平均推理时间</h4>
        <p className="text-2xl font-bold">{stats.avgProcessingTime}ms</p>
      </div>
      
      <div className="bg-yellow-50 p-4 rounded">
        <h4 className="text-sm text-gray-600">平均音频长度</h4>
        <p className="text-2xl font-bold">{stats.avgAudioLength}ms</p>
      </div>
      
      <div className="bg-purple-50 p-4 rounded">
        <h4 className="text-sm text-gray-600">模型版本</h4>
        <p className="text-sm">{stats.modelVersions.join(", ")}</p>
      </div>
    </div>
  );
}
```

---

## 6. 性能优化

### 6.1 边缘计算优化

| 优化项 | 方案 | 效果 |
|------|------|------|
| **模型量化** | 使用TFLite量化模型 | 模型大小 4MB，推理快速 |
| **批处理** | 缓存音频块后批量推理 | 提高吞吐量 |
| **缓存** | 缓存标签映射和模型 | 减少重复计算 |
| **多线程** | 采集和推理分离 | 避免阻塞 |

### 6.2 云端优化

| 优化项 | 方案 | 效果 |
|------|------|------|
| **数据库索引** | 在alarm_record_id上建立索引 | 加快查询 |
| **异步处理** | 使用消息队列处理推理结果 | 提高吞吐量 |
| **缓存** | Redis缓存统计数据 | 减少数据库查询 |
| **分片** | 按elderly_id分片存储 | 支持扩展 |

---

## 7. 测试

### 7.1 运行单元测试

```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
pnpm test server/yamnet.test.ts

# 查看测试覆盖率
pnpm test -- --coverage
```

### 7.2 测试覆盖内容

- ✅ YAMNet推理记录创建
- ✅ 推理结果查询
- ✅ 统计数据计算
- ✅ 标签映射逻辑
- ✅ 置信度计算
- ✅ 音频处理指标验证
- ✅ 多事件类型支持
- ✅ 性能指标追踪

---

## 8. 故障排除

### 问题1：推理时间过长

**症状**: 处理时间 > 500ms

**解决方案**:
- 检查树莓派CPU使用率
- 减少音频块大小
- 启用模型量化
- 检查网络延迟

### 问题2：置信度过低

**症状**: 大多数推理置信度 < 50%

**解决方案**:
- 检查音频质量
- 调整麦克风增益
- 更新YAMNet模型
- 收集更多训练数据

### 问题3：误报率高

**症状**: 假警报频繁

**解决方案**:
- 提高置信度阈值
- 优化标签映射规则
- 添加上下文判断
- 使用多模型集成

---

## 9. 后续改进方向

### 9.1 短期改进

- [ ] 支持自定义标签映射
- [ ] 添加置信度阈值配置
- [ ] 实现模型版本管理
- [ ] 添加推理结果缓存

### 9.2 中期改进

- [ ] 集成多个音频模型
- [ ] 实现模型在线更新
- [ ] 添加异常检测
- [ ] 支持实时流处理

### 9.3 长期改进

- [ ] 基于业务数据微调模型
- [ ] 开发专用的老年人音频模型
- [ ] 实现多模态融合（视频+音频）
- [ ] 部署边缘AI推理集群

---

## 10. 参考资源

- [YAMNet官方文档](https://github.com/google-research/yamnet)
- [AudioSet数据集](https://research.google.com/audioset/)
- [TensorFlow Lite指南](https://www.tensorflow.org/lite)
- [树莓派音频处理](https://www.raspberrypi.org/documentation/)

---

## 联系与支持

如有问题或建议，请联系技术团队。

**最后更新**: 2026年3月9日
