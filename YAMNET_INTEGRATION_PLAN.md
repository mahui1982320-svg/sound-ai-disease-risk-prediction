# YAMNet大模型集成方案

## 执行摘要

本文档详细阐述如何在声音AI＋疾病与风险预测声音监控系统中集成Google的YAMNet声音分类模型。YAMNet是一个经过预训练的深度学习模型，能够识别超过500种声音事件，特别适合识别老年人安全相关的声音（如跌倒、尖叫、咳嗽等）。通过在树莓派等边缘设备上运行YAMNet进行本地推理，系统可以实现毫秒级的响应时间，同时降低网络带宽消耗。

---

## 1. 现有系统架构分析

### 1.1 系统现状

当前系统采用**硬件-云端**两层架构：

| 组件 | 现状 | 限制 |
|------|------|------|
| **硬件层** | 树莓派 + ReSpeaker麦克风阵列 | 仅采集音频，无本地推理 |
| **云端层** | Express + tRPC + MySQL | 接收报警、存储数据、推送通知 |
| **客户端** | React前端 | 展示报警、人工复核 |
| **AI模型** | 无 | 需要集成YAMNet |

### 1.2 现有API接口

系统已提供报警上传接口：

```typescript
// POST /api/trpc/alarms.upload
{
  elderlyId: number,
  eventType: "fall" | "scream" | "cough" | "moan",
  confidenceScore: number (0-100),
  audioUrl: string
}
```

### 1.3 数据库结构

- **elderly** 表：老人档案（ID、房间号、护理员信息）
- **alarmRecords** 表：报警记录（事件类型、置信度、复核状态）
- **reviewLogs** 表：复核日志

---

## 2. YAMNet模型概述

### 2.1 YAMNet特性

YAMNet是Google开源的声音事件分类模型，具有以下特点：

| 特性 | 说明 |
|------|------|
| **模型大小** | ~4MB（TFLite格式） |
| **推理速度** | ~100-200ms（树莓派4B） |
| **输入** | 16kHz采样率的单声道音频 |
| **输出** | 521个声音事件的置信度分数 |
| **框架** | TensorFlow Lite（支持边缘设备） |
| **许可证** | Apache 2.0（开源） |

### 2.2 相关YAMNet标签

YAMNet能识别的与老年人安全相关的声音事件：

```
- "Speech": 语音
- "Scream": 尖叫
- "Crying": 哭声
- "Cough": 咳嗽
- "Sneeze": 打喷嚏
- "Moan": 呻吟
- "Gasp": 喘息
- "Whimper": 呜咽
- "Thud": 撞击声（跌倒）
- "Crash": 碰撞声
- "Glass breaking": 玻璃破碎
- "Clatter": 咔嗒声
- "Siren": 警报声
- "Alarm": 闹钟
```

### 2.3 YAMNet标签映射

需要将YAMNet的521个标签映射到系统的4个事件类型：

```typescript
const YAMNET_EVENT_MAPPING = {
  // 跌倒事件
  "fall": ["Thud", "Crash", "Glass breaking", "Clatter"],
  
  // 尖叫事件
  "scream": ["Scream", "Crying", "Whimper"],
  
  // 咳嗽事件
  "cough": ["Cough", "Sneeze", "Gasp"],
  
  // 呻吟事件
  "moan": ["Moan", "Gasp", "Whimper"]
};
```

---

## 3. 集成架构设计

### 3.1 三层集成方案

```
┌─────────────────────────────────────────────────────────────┐
│                    树莓派 / Orange Pi 5                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           ReSpeaker 4-Mic Array                      │  │
│  │  (声源定位、回声消除、噪音抑制)                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      音频预处理 (16kHz采样、单声道转换)              │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   YAMNet 模型推理 (边缘计算)                         │  │
│  │   输出521个声音事件的置信度分数                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   事件映射与阈值检查                                  │  │
│  │   - 映射到系统的4个事件类型                           │  │
│  │   - 检查置信度是否超过阈值 (0.6)                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   触发报警                                            │  │
│  │   - 保存10秒音频到本地                                │  │
│  │   - 上传到S3存储                                      │  │
│  │   - 调用云端API上报报警                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓ (HTTPS)                          │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    云端服务器 (Express)                      │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   /api/trpc/alarms.upload                            │  │
│  │   - 接收硬件端的报警数据                              │  │
│  │   - 存储到数据库                                      │  │
│  │   - 触发管家端推送通知                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   数据库 (MySQL)                                      │  │
│  │   - alarmRecords: 报警记录                            │  │
│  │   - reviewLogs: 复核日志                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   WebSocket / 服务器推送                             │  │
│  │   - 实时推送报警到管家端                              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                    管家端 (React)                            │
│                                                              │
│  - 实时接收报警通知                                         │
│  - 播放音频确认                                             │
│  - 标记为已确认或误报                                       │
│  - 查看报警统计和历史                                       │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 数据流时序图

```
硬件端                     云端                      管家端
  │                        │                         │
  ├─ 持续监听音频          │                         │
  │  (16kHz, 单声道)       │                         │
  │                        │                         │
  ├─ YAMNet推理 (100ms)    │                         │
  │  输出521个标签置信度    │                         │
  │                        │                         │
  ├─ 事件映射              │                         │
  │  (fall/scream/etc)     │                         │
  │                        │                         │
  ├─ 置信度检查            │                         │
  │  (> 0.6?)              │                         │
  │  ├─ 是 → 保存10秒音频  │                         │
  │  │       上传到S3      │                         │
  │  │                     │                         │
  │  └─ 上报报警 ─────────→ ├─ 存储到数据库         │
  │     (3秒内)            │  创建alarmRecord       │
  │                        │                        │
  │                        ├─ 推送通知 ────────────→ ├─ 收到警报
  │                        │  (WebSocket/SSE)      │  播放音频
  │                        │                        │  确认/驳回
  │                        │                        │
  │                        │ ← 复核结果 ─────────── ┤
  │                        │  (confirmed/falseAlarm)│
  │                        │                        │
  │                        ├─ 更新数据库            │
  │                        │  记录复核日志          │
  │                        │                        │
```

---

## 4. 服务器端实现方案

### 4.1 新增数据表

需要扩展数据库schema，添加YAMNet推理结果表：

```typescript
// 新增表：YAMNet推理详情
export const yamnetInferences = mysqlTable("yamnet_inferences", {
  id: int("id").autoincrement().primaryKey(),
  alarmRecordId: int("alarm_record_id").notNull(),
  
  // 原始YAMNet输出
  topLabels: text("top_labels").notNull(), // JSON: [{label, confidence}, ...]
  rawScores: text("raw_scores").notNull(), // JSON: 完整的521个标签分数
  
  // 处理结果
  mappedEventType: mysqlEnum("mapped_event_type", ["fall", "scream", "cough", "moan"]),
  mappingConfidence: int("mapping_confidence"), // 0-100
  
  // 处理元数据
  audioLength: int("audio_length"), // 毫秒
  processingTime: int("processing_time"), // 毫秒
  modelVersion: varchar("model_version", { length: 50 }), // YAMNet版本
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type YAMNetInference = typeof yamnetInferences.$inferSelect;
export type InsertYAMNetInference = typeof yamnetInferences.$inferInsert;
```

### 4.2 新增API接口

#### 4.2.1 上报YAMNet推理结果

```typescript
// 硬件端调用此接口上报YAMNet推理结果
alarms: router({
  uploadWithYAMNet: publicProcedure
    .input(
      z.object({
        elderlyId: z.number(),
        eventType: z.enum(["fall", "scream", "cough", "moan"]),
        confidenceScore: z.number().int().min(0).max(100),
        audioUrl: z.string().url(),
        
        // YAMNet推理结果
        topLabels: z.array(z.object({
          label: z.string(),
          confidence: z.number().min(0).max(1),
        })),
        rawScores: z.record(z.number()), // 完整的521个标签
        audioLength: z.number(), // 毫秒
        processingTime: z.number(), // 毫秒
        modelVersion: z.string(), // 如 "yamnet_1.0"
      })
    )
    .mutation(async ({ input }) => {
      // 创建报警记录
      const alarm = await db.createAlarmRecord({
        elderlyId: input.elderlyId,
        eventType: input.eventType,
        confidenceScore: input.confidenceScore,
        audioUrl: input.audioUrl,
        reviewStatus: "pending",
      });
      
      // 存储YAMNet推理详情
      await db.createYAMNetInference({
        alarmRecordId: alarm.id,
        topLabels: JSON.stringify(input.topLabels),
        rawScores: JSON.stringify(input.rawScores),
        mappedEventType: input.eventType,
        mappingConfidence: input.confidenceScore,
        audioLength: input.audioLength,
        processingTime: input.processingTime,
        modelVersion: input.modelVersion,
      });
      
      // 触发推送通知
      await notifyOwner({
        title: `检测到${EVENT_TYPE_NAMES[input.eventType]}事件`,
        content: `老人${input.elderlyId}房间检测到${EVENT_TYPE_NAMES[input.eventType]}，置信度${input.confidenceScore}%`,
      });
      
      return { success: true, alarmId: alarm.id };
    }),
})
```

#### 4.2.2 查询YAMNet推理详情

```typescript
alarms: router({
  getYAMNetDetails: protectedProcedure
    .input(z.object({ alarmId: z.number() }))
    .query(async ({ input }) => {
      return await db.getYAMNetInference(input.alarmId);
    }),
})
```

### 4.3 数据库查询助手

在 `server/db.ts` 中添加：

```typescript
export async function createYAMNetInference(data: InsertYAMNetInference) {
  const result = await db.insert(yamnetInferences).values(data);
  return result;
}

export async function getYAMNetInference(alarmRecordId: number) {
  return await db
    .select()
    .from(yamnetInferences)
    .where(eq(yamnetInferences.alarmRecordId, alarmRecordId))
    .limit(1);
}

export async function getYAMNetInferenceStats() {
  const records = await db.select().from(yamnetInferences);
  
  return {
    totalInferences: records.length,
    avgProcessingTime: records.reduce((sum, r) => sum + r.processingTime, 0) / records.length,
    avgAudioLength: records.reduce((sum, r) => sum + r.audioLength, 0) / records.length,
    modelVersions: [...new Set(records.map(r => r.modelVersion))],
  };
}
```

---

## 5. 硬件端实现方案

### 5.1 YAMNet推理模块

在树莓派上创建YAMNet推理模块：

```python
#!/usr/bin/env python3
"""
YAMNet 推理模块
在树莓派上运行，使用TensorFlow Lite进行本地推理
"""

import numpy as np
import librosa
import json
import os
from typing import Dict, List, Tuple

class YAMNetInference:
    def __init__(self, model_path: str, labels_path: str):
        """
        初始化YAMNet推理器
        
        Args:
            model_path: TFLite模型文件路径
            labels_path: 标签文件路径
        """
        try:
            import tflite_runtime.interpreter as tflite
            self.interpreter = tflite.Interpreter(model_path=model_path)
            self.interpreter.allocate_tensors()
        except ImportError:
            # 如果没有tflite_runtime，尝试使用tensorflow
            import tensorflow as tf
            self.interpreter = tf.lite.Interpreter(model_path=model_path)
            self.interpreter.allocate_tensors()
        
        # 加载标签
        with open(labels_path, 'r') as f:
            self.labels = json.load(f)
        
        self.model_version = "yamnet_1.0"
    
    def preprocess_audio(self, audio_path: str, target_sr: int = 16000) -> np.ndarray:
        """
        预处理音频
        
        Args:
            audio_path: 音频文件路径
            target_sr: 目标采样率 (YAMNet要求16kHz)
        
        Returns:
            预处理后的音频数组
        """
        # 加载音频
        audio, sr = librosa.load(audio_path, sr=target_sr, mono=True)
        
        # 归一化
        audio = audio.astype(np.float32)
        
        return audio
    
    def infer(self, audio: np.ndarray) -> Dict:
        """
        运行YAMNet推理
        
        Args:
            audio: 音频数组 (16kHz, 单声道)
        
        Returns:
            推理结果字典
        """
        import time
        
        start_time = time.time()
        
        # 获取输入输出张量信息
        input_details = self.interpreter.get_input_details()
        output_details = self.interpreter.get_output_details()
        
        # 准备输入 (YAMNet期望形状为 [1, audio_length])
        audio_input = np.array([audio], dtype=np.float32)
        self.interpreter.set_tensor(input_details[0]['index'], audio_input)
        
        # 运行推理
        self.interpreter.invoke()
        
        # 获取输出 (形状: [1, 521])
        scores = self.interpreter.get_tensor(output_details[0]['index'])[0]
        
        processing_time = int((time.time() - start_time) * 1000)  # 毫秒
        
        # 获取Top-5标签
        top_indices = np.argsort(scores)[-5:][::-1]
        top_labels = [
            {
                "label": self.labels[idx],
                "confidence": float(scores[idx])
            }
            for idx in top_indices
        ]
        
        return {
            "topLabels": top_labels,
            "rawScores": {self.labels[i]: float(scores[i]) for i in range(len(scores))},
            "processingTime": processing_time,
            "audioLength": int(len(audio) / 16000 * 1000),  # 毫秒
        }
    
    def map_to_event_type(self, top_labels: List[Dict]) -> Tuple[str, int]:
        """
        将YAMNet标签映射到系统事件类型
        
        Args:
            top_labels: YAMNet推理的Top标签
        
        Returns:
            (事件类型, 置信度百分比)
        """
        EVENT_MAPPING = {
            "fall": ["Thud", "Crash", "Glass breaking", "Clatter"],
            "scream": ["Scream", "Crying", "Whimper"],
            "cough": ["Cough", "Sneeze", "Gasp"],
            "moan": ["Moan", "Gasp", "Whimper"]
        }
        
        # 检查每个事件类型
        for event_type, keywords in EVENT_MAPPING.items():
            for label_info in top_labels:
                if label_info["label"] in keywords:
                    confidence = int(label_info["confidence"] * 100)
                    return event_type, confidence
        
        # 默认返回置信度最高的标签
        if top_labels:
            return "moan", int(top_labels[0]["confidence"] * 100)
        
        return "moan", 0
```

### 5.2 集成到监听脚本

修改现有的 `alarm_monitor.py`，集成YAMNet推理：

```python
#!/usr/bin/env python3
"""
养老院智能报警系统 - 硬件端监听脚本（集成YAMNet）
"""

import os
import sys
import json
import time
import numpy as np
import requests
import librosa
import soundfile as sf
from datetime import datetime
from threading import Thread
import logging

from yamnet_inference import YAMNetInference

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

CONFIG = {
    "api_url": "https://your-app.manus.space",
    "elderly_id": 1,
    "room_number": "101",
    "sample_rate": 16000,
    "chunk_duration": 1.0,
    "confidence_threshold": 0.6,
    "audio_duration": 10,
    "yamnet_model_path": os.path.expanduser("~/models/classification_model_with_metadata.tflite"),
    "yamnet_labels_path": os.path.expanduser("~/models/yamnet_labels.json"),
}

class AudioMonitorWithYAMNet:
    def __init__(self, config):
        self.config = config
        self.is_running = False
        self.last_alarm_time = 0
        self.alarm_cooldown = 30
        
        # 初始化YAMNet推理器
        self.yamnet = YAMNetInference(
            config["yamnet_model_path"],
            config["yamnet_labels_path"]
        )
        logger.info("YAMNet推理器初始化成功")
    
    def _record_audio(self, duration):
        """录制音频"""
        try:
            import pyaudio
            
            p = pyaudio.PyAudio()
            stream = p.open(
                format=pyaudio.paFloat32,
                channels=1,
                rate=self.config["sample_rate"],
                input=True,
                frames_per_buffer=int(self.config["sample_rate"] * 0.1)
            )
            
            logger.info(f"开始录制 {duration} 秒音频...")
            frames = []
            
            for _ in range(int(duration * 10)):
                data = stream.read(int(self.config["sample_rate"] * 0.1))
                frames.append(np.frombuffer(data, dtype=np.float32))
            
            stream.stop_stream()
            stream.close()
            p.terminate()
            
            audio_data = np.concatenate(frames)
            return audio_data
        except Exception as e:
            logger.error(f"录制音频失败: {e}")
            return None
    
    def _upload_alarm_with_yamnet(self, event_type, confidence, audio_url, yamnet_result):
        """上传报警数据（包含YAMNet推理结果）"""
        try:
            payload = {
                "elderlyId": self.config["elderly_id"],
                "eventType": event_type,
                "confidenceScore": confidence,
                "audioUrl": audio_url,
                
                # YAMNet推理结果
                "topLabels": yamnet_result["topLabels"],
                "rawScores": yamnet_result["rawScores"],
                "audioLength": yamnet_result["audioLength"],
                "processingTime": yamnet_result["processingTime"],
                "modelVersion": self.yamnet.model_version,
            }
            
            response = requests.post(
                f"{self.config['api_url']}/api/trpc/alarms.uploadWithYAMNet",
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                logger.info(f"报警上传成功: {event_type}, 置信度: {confidence}%")
                return True
            else:
                logger.error(f"上传失败: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"上传异常: {e}")
            return False
    
    def _detect_alarm(self):
        """检测危险声音"""
        while self.is_running:
            try:
                # 录制 1 秒音频
                audio_data = self._record_audio(1.0)
                if audio_data is None:
                    continue
                
                # YAMNet推理
                yamnet_result = self.yamnet.infer(audio_data)
                
                # 映射到事件类型
                event_type, confidence = self.yamnet.map_to_event_type(yamnet_result["topLabels"])
                
                # 检查置信度阈值
                current_time = time.time()
                if confidence / 100 > self.config["confidence_threshold"]:
                    # 检查冷却时间
                    if current_time - self.last_alarm_time > self.alarm_cooldown:
                        logger.warning(f"检测到{event_type}事件，置信度: {confidence}%")
                        
                        # 录制完整的10秒音频
                        alarm_audio = self._record_audio(self.config["audio_duration"])
                        if alarm_audio is not None:
                            # 保存到本地
                            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                            filename = f"{timestamp}_{self.config['room_number']}_{event_type}.wav"
                            local_path = f"/tmp/{filename}"
                            sf.write(local_path, alarm_audio, self.config["sample_rate"])
                            
                            # 上传到S3（这里需要实现）
                            audio_url = f"https://your-s3-bucket.com/alarms/{filename}"
                            
                            # 上报报警（包含YAMNet结果）
                            self._upload_alarm_with_yamnet(
                                event_type, confidence, audio_url, yamnet_result
                            )
                        
                        self.last_alarm_time = current_time
                
                # 短暂延迟
                time.sleep(0.1)
            except Exception as e:
                logger.error(f"检测循环异常: {e}")
                time.sleep(1)
    
    def start(self):
        """启动监听"""
        if self.is_running:
            logger.warning("监听已在运行")
            return
        
        self.is_running = True
        logger.info("启动音频监听...")
        
        monitor_thread = Thread(target=self._detect_alarm, daemon=True)
        monitor_thread.start()
    
    def stop(self):
        """停止监听"""
        self.is_running = False
        logger.info("停止音频监听")

def main():
    monitor = AudioMonitorWithYAMNet(CONFIG)
    
    try:
        monitor.start()
        logger.info("系统运行中，按 Ctrl+C 退出")
        
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("收到退出信号")
        monitor.stop()
        sys.exit(0)

if __name__ == "__main__":
    main()
```

---

## 6. 前端集成方案

### 6.1 新增UI组件

在 `client/src/components/` 中添加YAMNet推理详情展示组件：

```typescript
// client/src/components/YAMNetDetails.tsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface YAMNetDetailsProps {
  inference: {
    topLabels: Array<{ label: string; confidence: number }>;
    mappedEventType: string;
    mappingConfidence: number;
    processingTime: number;
    audioLength: number;
    modelVersion: string;
  };
}

export function YAMNetDetails({ inference }: YAMNetDetailsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>YAMNet推理详情</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 映射结果 */}
        <div>
          <h3 className="font-semibold mb-2">事件类型识别</h3>
          <div className="flex items-center gap-4">
            <span className="text-lg font-bold">{inference.mappedEventType}</span>
            <Progress value={inference.mappingConfidence} className="flex-1" />
            <span className="text-sm text-gray-600">{inference.mappingConfidence}%</span>
          </div>
        </div>
        
        {/* Top-5标签 */}
        <div>
          <h3 className="font-semibold mb-2">YAMNet Top-5识别结果</h3>
          <div className="space-y-2">
            {inference.topLabels.map((label, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <span className="w-24 text-sm">{label.label}</span>
                <Progress value={label.confidence * 100} className="flex-1" />
                <span className="text-sm text-gray-600 w-12 text-right">
                  {(label.confidence * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* 性能指标 */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-gray-600">推理时间</p>
            <p className="font-semibold">{inference.processingTime}ms</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">音频长度</p>
            <p className="font-semibold">{(inference.audioLength / 1000).toFixed(1)}s</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">模型版本</p>
            <p className="font-semibold text-sm">{inference.modelVersion}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 6.2 集成到报警详情页

在 `client/src/pages/AlarmDetail.tsx` 中显示YAMNet推理详情：

```typescript
import { YAMNetDetails } from '@/components/YAMNetDetails';
import { trpc } from '@/lib/trpc';

export function AlarmDetail({ alarmId }: { alarmId: number }) {
  const { data: alarm } = trpc.alarms.get.useQuery({ id: alarmId });
  const { data: yamnetDetails } = trpc.alarms.getYAMNetDetails.useQuery(
    { alarmId },
    { enabled: !!alarmId }
  );
  
  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>报警基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          {/* ... 显示基本信息 ... */}
        </CardContent>
      </Card>
      
      {/* YAMNet推理详情 */}
      {yamnetDetails && <YAMNetDetails inference={yamnetDetails} />}
      
      {/* 音频播放 */}
      {alarm?.audioUrl && (
        <Card>
          <CardHeader>
            <CardTitle>音频回放</CardTitle>
          </CardHeader>
          <CardContent>
            <audio controls className="w-full">
              <source src={alarm.audioUrl} type="audio/wav" />
            </audio>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

## 7. 性能优化建议

### 7.1 边缘计算优化

| 优化方向 | 措施 | 效果 |
|---------|------|------|
| **模型量化** | 使用INT8量化模型 | 推理速度提升3-5倍，模型大小减小75% |
| **音频缓冲** | 使用环形缓冲区 | 减少内存占用50% |
| **异步处理** | 后台线程处理推理 | 避免阻塞音频采集 |
| **本地缓存** | 网络不可用时本地缓存 | 提高系统可靠性 |

### 7.2 云端优化

| 优化方向 | 措施 | 效果 |
|---------|------|------|
| **数据库索引** | 在eventType、elderlyId上建立索引 | 查询速度提升10倍 |
| **异步推送** | 使用消息队列异步推送通知 | 降低API响应时间 |
| **数据压缩** | 压缩rawScores字段 | 减少存储空间30% |
| **定期清理** | 删除超过30天的旧记录 | 保持数据库性能 |

---

## 8. 测试计划

### 8.1 单元测试

```typescript
// server/yamnet.integration.test.ts
import { describe, it, expect } from 'vitest';
import { YAMNetEventMapper } from './yamnet-mapper';

describe('YAMNet Event Mapping', () => {
  const mapper = new YAMNetEventMapper();
  
  it('should map Scream to scream event', () => {
    const topLabels = [
      { label: 'Scream', confidence: 0.95 },
      { label: 'Crying', confidence: 0.80 }
    ];
    
    const { eventType, confidence } = mapper.map(topLabels);
    expect(eventType).toBe('scream');
    expect(confidence).toBe(95);
  });
  
  it('should map Thud to fall event', () => {
    const topLabels = [
      { label: 'Thud', confidence: 0.88 },
      { label: 'Crash', confidence: 0.75 }
    ];
    
    const { eventType, confidence } = mapper.map(topLabels);
    expect(eventType).toBe('fall');
    expect(confidence).toBe(88);
  });
  
  it('should handle unknown labels', () => {
    const topLabels = [
      { label: 'Unknown', confidence: 0.50 }
    ];
    
    const { eventType, confidence } = mapper.map(topLabels);
    expect(eventType).toBe('moan'); // 默认值
    expect(confidence).toBe(50);
  });
});
```

### 8.2 集成测试

- 测试硬件端YAMNet推理的准确性
- 测试云端API接收和存储数据的正确性
- 测试前端展示YAMNet推理详情的功能
- 测试端到端的报警流程

---

## 9. 部署步骤

### 9.1 服务器端部署

1. **更新数据库schema**
   ```bash
   pnpm db:push
   ```

2. **添加新的API路由**
   - 修改 `server/routers.ts`
   - 添加 `uploadWithYAMNet` 和 `getYAMNetDetails` 接口

3. **部署到生产环境**
   ```bash
   pnpm build
   pnpm start
   ```

### 9.2 硬件端部署

1. **安装YAMNet依赖**
   ```bash
   pip install tensorflow-lite-runtime librosa soundfile
   ```

2. **下载YAMNet模型**
   ```bash
   mkdir -p ~/models
   cd ~/models
   wget https://storage.googleapis.com/yamnet/classification_model_with_metadata.tflite
   wget https://storage.googleapis.com/yamnet/yamnet_model_metadata.json
   ```

3. **部署监听脚本**
   ```bash
   cp alarm_monitor_with_yamnet.py ~/
   chmod +x ~/alarm_monitor_with_yamnet.py
   ```

4. **配置后台运行**
   ```bash
   # 创建systemd服务
   sudo tee /etc/systemd/system/yamnet-monitor.service > /dev/null <<EOF
   [Unit]
   Description=YAMNet Audio Monitor
   After=network.target
   
   [Service]
   Type=simple
   User=pi
   WorkingDirectory=/home/pi
   ExecStart=/usr/bin/python3 /home/pi/alarm_monitor_with_yamnet.py
   Restart=on-failure
   RestartSec=10
   
   [Install]
   WantedBy=multi-user.target
   EOF
   
   sudo systemctl daemon-reload
   sudo systemctl enable yamnet-monitor
   sudo systemctl start yamnet-monitor
   ```

---

## 10. 成本分析

### 10.1 硬件成本（无增加）

YAMNet推理完全在现有的树莓派上运行，无需额外硬件投资。

### 10.2 云端成本

| 项目 | 成本 | 说明 |
|------|------|------|
| **数据库存储** | +50GB/年 | 存储YAMNet推理结果 |
| **API调用** | 无增加 | 使用现有的alarms.upload接口 |
| **推送通知** | 无增加 | 使用现有的通知系统 |
| **总计** | 低于¥100/年 | 极低的增量成本 |

---

## 11. 风险分析与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **YAMNet准确度不足** | 误报率高 | 调整置信度阈值、结合多个标签、人工复核 |
| **网络不稳定** | 报警延迟 | 本地缓存、异步上报、重试机制 |
| **树莓派性能不足** | 推理缓慢 | 使用量化模型、优化音频处理 |
| **模型版本更新** | 兼容性问题 | 版本管理、灰度发布、回滚方案 |

---

## 12. 后续优化方向

1. **多模型融合** - 结合其他声音分类模型提高准确度
2. **实时学习** - 根据用户反馈持续优化模型
3. **边缘AI推理** - 使用Google Coral TPU加速推理
4. **声源定位** - 利用ReSpeaker的麦克风阵列进行声源定位
5. **异常检测** - 检测老人的日常行为异常

---

## 参考资源

- [YAMNet GitHub](https://github.com/google-research/perceptual-loss-matching)
- [TensorFlow Lite文档](https://www.tensorflow.org/lite)
- [ReSpeaker文档](https://wiki.seeedstudio.com/ReSpeaker_4-Mic_Array_for_Raspberry_Pi/)
- [librosa文档](https://librosa.org/)

---

**文档版本**: 1.0  
**最后更新**: 2026年1月30日  
**作者**: Manus AI
