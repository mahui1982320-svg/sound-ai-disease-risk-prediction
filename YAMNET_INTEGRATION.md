# YAMNet 音频事件识别模型集成指南

## 📋 概述

YAMNet 是谷歌开源的轻量级音频事件识别模型，可在边缘设备（如树莓派）上实时运行。本指南详细说明如何将 YAMNet 集成到养老院智能报警系统中。

---

## 🎯 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                    树莓派 4B / 香橙派                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ ReSpeaker    │  │ YAMNet 模型  │  │ 上传脚本     │  │
│  │ 麦克风阵列   │→ │ 音频分析     │→ │ HTTP 请求   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
                    云端后台系统
                    (本系统)
```

---

## 🔧 YAMNet 模型详解

### 模型特性
- **输入**：音频波形（16kHz 采样率）
- **输出**：521 个音频事件的置信度分数
- **模型大小**：~15MB（TensorFlow Lite 版本）
- **推理时间**：~100-200ms（树莓派 4B）
- **精度**：在常见事件上 mAP 达到 63.3%

### 关键音频事件类别

| 事件类别 | 标签 | 应用场景 |
|---------|------|--------|
| 摔倒声 | Fall, Thud | 老人摔倒检测 |
| 尖叫声 | Scream, Shout | 紧急求救 |
| 咳嗽声 | Cough | 健康监测 |
| 呻吟声 | Moan, Groan | 疼痛信号 |
| 玻璃破碎 | Glass breaking | 安全威胁 |
| 门铃 | Doorbell | 访客通知 |

---

## 📦 硬件端实现（树莓派）

### 第一步：环境安装

```bash
# SSH 连接到树莓派
ssh pi@<树莓派IP>

# 更新系统
sudo apt-get update && sudo apt-get upgrade -y

# 安装依赖
sudo apt-get install -y python3-pip python3-dev
sudo apt-get install -y libatlas-base-dev libjasper-dev libtiff5 libjasper1 libharfbuzz0b libwebp6 libtiff5 libjasper1

# 安装 Python 包
pip3 install --upgrade pip
pip3 install numpy tensorflow-lite
pip3 install requests
pip3 install librosa  # 音频处理
pip3 install sounddevice  # 实时音频采集
```

### 第二步：下载 YAMNet 模型

```bash
# 创建模型目录
mkdir -p ~/yamnet_model
cd ~/yamnet_model

# 下载模型文件
wget https://storage.googleapis.com/download.tensorflow.org/models/tflite/yamnet_classification_tflite_1.tar.gz

# 解压
tar -xzf yamnet_classification_tflite_1.tar.gz

# 验证文件
ls -la
# 应该看到：
# - yamnet.tflite (模型文件)
# - yamnet_labels.txt (标签文件)
# - yamnet_model.tflite (完整模型)
```

### 第三步：创建音频采集和分析脚本

创建文件：`/home/pi/elderly_monitor.py`

```python
#!/usr/bin/env python3
"""
养老院智能报警系统 - 树莓派端音频采集和分析脚本
"""

import os
import sys
import json
import time
import numpy as np
import requests
import librosa
import sounddevice as sd
from collections import deque
from datetime import datetime
import threading
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/home/pi/elderly_monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ==================== 配置参数 ====================
YAMNET_MODEL_PATH = '/home/pi/yamnet_model/yamnet.tflite'
YAMNET_LABELS_PATH = '/home/pi/yamnet_model/yamnet_labels.txt'
BACKEND_URL = 'https://your-domain.com/api/trpc/alarms.upload'  # 替换为实际后端 URL
ELDERLY_ID = 1  # 老人 ID（可通过环境变量或配置文件设置）

# 音频采集参数
SAMPLE_RATE = 16000  # YAMNet 要求 16kHz
CHUNK_DURATION = 1  # 每次采集 1 秒
CHUNK_SIZE = SAMPLE_RATE * CHUNK_DURATION

# 危险事件阈值
DANGER_EVENTS = {
    'Fall': 0.6,
    'Thud': 0.6,
    'Scream': 0.6,
    'Shout': 0.5,
    'Cough': 0.7,
    'Moan': 0.6,
    'Glass breaking': 0.7,
}

# 音频缓冲区（用于保存触发报警前的音频）
BUFFER_DURATION = 10  # 保存 10 秒音频
BUFFER_SIZE = SAMPLE_RATE * BUFFER_DURATION

# ==================== YAMNet 模型加载 ====================

def load_yamnet_model():
    """加载 YAMNet TensorFlow Lite 模型"""
    try:
        import tensorflow as tf
        
        # 加载模型
        interpreter = tf.lite.Interpreter(model_path=YAMNET_MODEL_PATH)
        interpreter.allocate_tensors()
        
        # 获取输入输出信息
        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()
        
        logger.info("YAMNet 模型加载成功")
        return interpreter, input_details, output_details
    except Exception as e:
        logger.error(f"模型加载失败: {e}")
        sys.exit(1)

def load_yamnet_labels():
    """加载 YAMNet 标签"""
    try:
        with open(YAMNET_LABELS_PATH, 'r') as f:
            labels = [line.strip() for line in f.readlines()]
        logger.info(f"加载 {len(labels)} 个标签")
        return labels
    except Exception as e:
        logger.error(f"标签加载失败: {e}")
        sys.exit(1)

# ==================== 音频预处理 ====================

def preprocess_audio(audio_chunk):
    """
    预处理音频，转换为 YAMNet 输入格式
    
    Args:
        audio_chunk: numpy 数组，采样率 16kHz
    
    Returns:
        预处理后的音频数组
    """
    # 归一化到 [-1, 1]
    audio_chunk = audio_chunk.astype(np.float32)
    if np.max(np.abs(audio_chunk)) > 0:
        audio_chunk = audio_chunk / np.max(np.abs(audio_chunk))
    
    return audio_chunk

def extract_features(audio_chunk, interpreter, input_details):
    """
    使用 YAMNet 提取音频特征
    
    Args:
        audio_chunk: 音频数组
        interpreter: TensorFlow Lite 解释器
        input_details: 输入信息
    
    Returns:
        特征向量
    """
    # 预处理
    audio_input = preprocess_audio(audio_chunk)
    
    # 设置输入
    interpreter.set_tensor(input_details[0]['index'], 
                          audio_input.reshape(input_details[0]['shape']))
    
    # 运行推理
    interpreter.invoke()
    
    return interpreter

# ==================== 音频分析 ====================

def analyze_audio(audio_chunk, interpreter, input_details, output_details, labels):
    """
    分析音频，识别事件
    
    Args:
        audio_chunk: 音频数组
        interpreter: 模型解释器
        input_details: 输入信息
        output_details: 输出信息
        labels: 标签列表
    
    Returns:
        识别结果字典
    """
    try:
        # 预处理
        audio_input = preprocess_audio(audio_chunk)
        
        # 设置输入
        interpreter.set_tensor(input_details[0]['index'],
                              audio_input.reshape(input_details[0]['shape']))
        
        # 运行推理
        interpreter.invoke()
        
        # 获取输出
        output_data = interpreter.get_tensor(output_details[0]['index'])
        
        # 解析结果
        results = []
        for idx, score in enumerate(output_data[0]):
            if idx < len(labels):
                results.append({
                    'event': labels[idx],
                    'confidence': float(score)
                })
        
        # 按置信度排序
        results.sort(key=lambda x: x['confidence'], reverse=True)
        
        return results[:10]  # 返回置信度最高的 10 个事件
    
    except Exception as e:
        logger.error(f"音频分析失败: {e}")
        return []

def detect_danger_event(analysis_results):
    """
    检测是否存在危险事件
    
    Args:
        analysis_results: 分析结果列表
    
    Returns:
        (是否危险, 事件类型, 置信度)
    """
    for result in analysis_results:
        event = result['event']
        confidence = result['confidence']
        
        # 检查是否是危险事件
        for danger_event, threshold in DANGER_EVENTS.items():
            if danger_event.lower() in event.lower() and confidence >= threshold:
                return True, event, confidence
    
    return False, None, None

# ==================== 音频上传 ====================

def upload_alarm(audio_data, event_type, confidence, audio_url=None):
    """
    上传报警数据到后端
    
    Args:
        audio_data: 音频数据（numpy 数组）
        event_type: 事件类型
        confidence: 置信度
        audio_url: OSS 音频链接（可选）
    """
    try:
        # 准备数据
        payload = {
            'elderlyId': ELDERLY_ID,
            'eventType': event_type,
            'confidence': confidence,
            'timestamp': datetime.now().isoformat(),
            'audioUrl': audio_url,  # 如果已上传到 OSS
            'rawAudio': None  # 可选：发送原始音频数据
        }
        
        # 发送请求
        response = requests.post(
            BACKEND_URL,
            json=payload,
            timeout=10,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code == 200:
            logger.info(f"报警上传成功: {event_type} ({confidence:.2%})")
            return True
        else:
            logger.error(f"报警上传失败: {response.status_code} - {response.text}")
            return False
    
    except Exception as e:
        logger.error(f"上传异常: {e}")
        return False

# ==================== 实时音频采集 ====================

class AudioMonitor:
    """实时音频监测类"""
    
    def __init__(self, interpreter, input_details, output_details, labels):
        self.interpreter = interpreter
        self.input_details = input_details
        self.output_details = output_details
        self.labels = labels
        self.audio_buffer = deque(maxlen=BUFFER_SIZE)
        self.is_running = False
    
    def audio_callback(self, indata, frames, time_info, status):
        """音频采集回调函数"""
        if status:
            logger.warning(f"音频采集状态: {status}")
        
        # 添加到缓冲区
        audio_chunk = indata[:, 0]  # 单声道
        self.audio_buffer.extend(audio_chunk)
    
    def start_monitoring(self):
        """启动监测"""
        self.is_running = True
        logger.info("启动音频监测...")
        
        try:
            with sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=1,
                blocksize=CHUNK_SIZE,
                callback=self.audio_callback,
                device=None  # 使用默认设备
            ):
                while self.is_running:
                    # 每隔 CHUNK_DURATION 秒分析一次
                    time.sleep(CHUNK_DURATION)
                    
                    if len(self.audio_buffer) >= CHUNK_SIZE:
                        # 获取最新的音频块
                        audio_chunk = np.array(list(self.audio_buffer)[-CHUNK_SIZE:])
                        
                        # 分析
                        results = analyze_audio(
                            audio_chunk,
                            self.interpreter,
                            self.input_details,
                            self.output_details,
                            self.labels
                        )
                        
                        # 检测危险事件
                        is_danger, event_type, confidence = detect_danger_event(results)
                        
                        if is_danger:
                            logger.warning(f"检测到危险事件: {event_type} ({confidence:.2%})")
                            
                            # 获取触发前的 10 秒音频
                            alarm_audio = np.array(list(self.audio_buffer))
                            
                            # 上传报警
                            upload_alarm(alarm_audio, event_type, confidence)
                        
                        # 打印前 3 个事件
                        logger.info(f"分析结果: {results[:3]}")
        
        except KeyboardInterrupt:
            logger.info("监测已停止")
        except Exception as e:
            logger.error(f"监测异常: {e}")
        finally:
            self.is_running = False

# ==================== 主程序 ====================

def main():
    """主程序"""
    logger.info("=" * 50)
    logger.info("养老院智能报警系统 - 树莓派端")
    logger.info("=" * 50)
    
    # 加载模型
    logger.info("加载 YAMNet 模型...")
    interpreter, input_details, output_details = load_yamnet_model()
    
    # 加载标签
    logger.info("加载标签...")
    labels = load_yamnet_labels()
    
    # 启动监测
    monitor = AudioMonitor(interpreter, input_details, output_details, labels)
    monitor.start_monitoring()

if __name__ == '__main__':
    main()
```

### 第四步：配置和运行

```bash
# 编辑脚本，设置正确的后端 URL 和老人 ID
nano /home/pi/elderly_monitor.py

# 添加执行权限
chmod +x /home/pi/elderly_monitor.py

# 测试运行
python3 /home/pi/elderly_monitor.py

# 设置开机自启（使用 systemd）
sudo nano /etc/systemd/system/elderly-monitor.service
```

创建 systemd 服务文件内容：

```ini
[Unit]
Description=Elderly Safety Monitor
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 /home/pi/elderly_monitor.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable elderly-monitor.service
sudo systemctl start elderly-monitor.service

# 查看日志
sudo journalctl -u elderly-monitor.service -f
```

---

## 🔌 后端 API 集成

### 现有 API 端点

系统已包含报警上传 API：

```typescript
// POST /api/trpc/alarms.upload
{
  "elderlyId": 1,
  "eventType": "Fall",
  "confidence": 0.85,
  "timestamp": "2026-01-21T08:30:45.000Z",
  "audioUrl": "https://oss.example.com/audio/alarm_20260121_083045.wav"
}
```

### 响应格式

```json
{
  "success": true,
  "alarmId": 123,
  "message": "报警已记录"
}
```

---

## 🧪 测试方案

### 方案 A：使用测试音频文件

```python
# 测试脚本：test_yamnet.py
import numpy as np
import librosa

# 加载测试音频
audio_path = '/path/to/test_audio.wav'
audio, sr = librosa.load(audio_path, sr=16000)

# 分析
results = analyze_audio(audio, interpreter, input_details, output_details, labels)
print(results)
```

### 方案 B：录制真实音频测试

```bash
# 录制 5 秒音频
arecord -d 5 -r 16000 -f S16_LE test_audio.wav

# 播放测试
aplay test_audio.wav
```

---

## 📊 性能优化

### 1. 模型量化
使用 TensorFlow Lite 的量化版本可进一步减小模型大小和推理时间。

### 2. 多线程处理
在后台线程运行分析，避免阻塞音频采集。

### 3. 缓存管理
使用循环缓冲区存储音频，减少内存占用。

---

## ⚠️ 常见问题

### Q1: 树莓派上运行缓慢？
**A:** 
- 使用 TensorFlow Lite 而非完整 TensorFlow
- 启用 GPU 加速（如果支持）
- 增加采样间隔

### Q2: 误报率高？
**A:**
- 调整 `DANGER_EVENTS` 中的置信度阈值
- 收集本地数据进行模型微调
- 使用背景噪音过滤

### Q3: 网络连接不稳定？
**A:**
- 实现本地缓存机制
- 添加重试逻辑
- 使用 MQTT 协议替代 HTTP

---

## 🔐 安全建议

1. **API 认证**：使用 API Key 或 JWT 认证
2. **数据加密**：HTTPS 传输，音频加密存储
3. **隐私保护**：仅上传必要数据，定期删除原始音频
4. **日志管理**：定期轮转日志文件

---

## 📚 参考资源

- [YAMNet GitHub](https://github.com/tensorflow/models/tree/master/research/audio_set/yamnet)
- [TensorFlow Lite 文档](https://www.tensorflow.org/lite)
- [树莓派官方文档](https://www.raspberrypi.org/documentation/)
- [ReSpeaker 文档](https://wiki.seeedstudio.com/ReSpeaker_4-Mic_Array_for_Raspberry_Pi/)

