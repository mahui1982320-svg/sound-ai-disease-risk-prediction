# YAMNet 模型集成完整指南

## 概述

本文档详细说明如何在养老院智能报警管理系统中集成谷歌的 YAMNet 音频事件识别模型。YAMNet 是一个预训练的深度学习模型，可以识别 521 种不同的音频事件，特别适合识别危险声音（摔倒、尖叫、咳嗽、呻吟等）。

## 系统架构

```
树莓派（硬件端）
    ↓
[ReSpeaker 麦克风阵列] → [YAMNet 模型推理] → [音频分析]
    ↓
[危险事件检测] → [上传报警数据] → [后端系统]
    ↓
[数据库存储] → [管家端管理界面] → [人工复核]
```

## YAMNet 模型详解

### 模型特性

- **输入**：16kHz 采样率的单声道音频
- **输出**：521 个音频事件的置信度分数
- **模型大小**：约 4.7 MB（TensorFlow Lite 版本）
- **推理时间**：树莓派上约 100-200ms（10 秒音频）
- **准确率**：在常见事件上 mAP 达 63.3%

### 危险事件映射

| YAMNet 事件 | 我们的分类 | 说明 |
|-----------|---------|------|
| Thud, Bang, Crash, Clatter, Falling | fall | 摔倒事件 |
| Scream, Shriek, Yell, Shout, Cry | scream | 尖叫事件 |
| Cough, Throat clearing | cough | 咳嗽事件 |
| Moan, Groan, Whimper, Sigh | moan | 呻吟事件 |

## 树莓派端部署

### 1. 硬件要求

- **主控板**：树莓派 4B 或香橙派 5
- **麦克风**：ReSpeaker 4-Mic Array
- **存储**：至少 2GB 可用空间
- **网络**：WiFi 或以太网连接

### 2. 环境安装

```bash
# SSH 连接到树莓派
ssh pi@<树莓派IP>

# 更新系统
sudo apt-get update && sudo apt-get upgrade -y

# 安装 Python 依赖
sudo apt-get install -y python3-pip python3-dev
sudo apt-get install -y libatlas-base-dev libjasper-dev libtiff5 libjasper1 libharfbuzz0b libwebp6 libtiff5

# 安装 Python 包
pip3 install --upgrade pip
pip3 install numpy tensorflow-lite requests librosa sounddevice soundfile

# 安装 ReSpeaker 驱动（可选）
pip3 install respeaker
```

### 3. 下载 YAMNet 模型

```bash
# 创建模型目录
mkdir -p ~/yamnet_model && cd ~/yamnet_model

# 下载 YAMNet TensorFlow Lite 模型
wget https://storage.googleapis.com/download.tensorflow.org/models/tflite/yamnet_classification_tflite_1.tar.gz

# 解压
tar -xzf yamnet_classification_tflite_1.tar.gz

# 验证文件
ls -la
# 应该看到：yamnet.tflite, yamnet_labels.txt, yamnet_model.tflite
```

### 4. 部署监控脚本

```bash
# 复制脚本到树莓派
scp raspberry_pi_yamnet.py pi@<树莓派IP>:~/

# SSH 连接到树莓派
ssh pi@<树莓派IP>

# 配置环境变量
export BACKEND_URL="https://eldersafe-fv6io3sc.manus.space/api/trpc"
export ELDERLY_ID="30001"

# 运行脚本
python3 ~/raspberry_pi_yamnet.py
```

### 5. 开机自启配置

创建 systemd 服务文件：

```bash
sudo nano /etc/systemd/system/yamnet-monitor.service
```

添加以下内容：

```ini
[Unit]
Description=YAMNet Audio Monitoring Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
Environment="BACKEND_URL=https://eldersafe-fv6io3sc.manus.space/api/trpc"
Environment="ELDERLY_ID=30001"
ExecStart=/usr/bin/python3 /home/pi/raspberry_pi_yamnet.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启用服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable yamnet-monitor
sudo systemctl start yamnet-monitor

# 查看日志
sudo journalctl -u yamnet-monitor -f
```

## 后端 API 集成

### 1. 音频分析 API

**端点**：`POST /api/trpc/alarms.analyzeAudio`

**请求体**：
```json
{
  "jsonrpc": "2.0",
  "method": "alarms.analyzeAudio",
  "params": {
    "audioUrl": "https://oss.example.com/audio/alarm_20260123_101234.wav",
    "elderlyId": 30001
  },
  "id": 1
}
```

**响应**：
```json
{
  "result": {
    "eventType": "fall",
    "confidence": 85,
    "yamnetPredictions": [
      { "label": "Thud", "score": 0.85 },
      { "label": "Bang", "score": 0.72 },
      { "label": "Crash", "score": 0.65 }
    ]
  }
}
```

### 2. 批量分析 API

**端点**：`POST /api/trpc/alarms.analyzeAudioBatch`

**请求体**：
```json
{
  "jsonrpc": "2.0",
  "method": "alarms.analyzeAudioBatch",
  "params": {
    "audioUrls": [
      "https://oss.example.com/audio/alarm_1.wav",
      "https://oss.example.com/audio/alarm_2.wav"
    ]
  },
  "id": 1
}
```

## 前端集成

### 1. 上传音频文件

在前端添加音频上传功能：

```typescript
// 上传音频文件
async function uploadAndAnalyzeAudio(file: File) {
  // 1. 上传到 OSS
  const audioUrl = await uploadToOSS(file);
  
  // 2. 调用后端 API 进行分析
  const result = await trpc.alarms.analyzeAudio.mutate({
    audioUrl,
    elderlyId: 30001,
  });
  
  // 3. 显示分析结果
  console.log('事件类型:', result.eventType);
  console.log('置信度:', result.confidence);
}
```

### 2. 实时预览

在报警详情中显示 YAMNet 分析结果：

```typescript
interface AlarmWithAnalysis {
  alarm: AlarmRecord;
  yamnetAnalysis?: {
    eventType: string;
    confidence: number;
    predictions: Array<{ label: string; score: number }>;
  };
}
```

## 性能优化

### 1. 模型量化

使用 TensorFlow Lite 的量化版本以提高推理速度：

```bash
# 下载量化模型
wget https://storage.googleapis.com/download.tensorflow.org/models/tflite/yamnet_classification_tflite_1_quant.tar.gz
```

### 2. 多线程处理

在树莓派上使用多线程处理音频采集和分析：

```python
import threading

def audio_capture_thread():
    """音频采集线程"""
    while True:
        audio = record_audio()
        audio_queue.put(audio)

def analysis_thread():
    """分析线程"""
    while True:
        audio = audio_queue.get()
        result = analyze_audio(audio)
        result_queue.put(result)
```

### 3. 缓存管理

缓存最近的分析结果以避免重复计算：

```python
from functools import lru_cache

@lru_cache(maxsize=100)
def analyze_audio_cached(audio_hash: str):
    return analyze_audio(audio_hash)
```

## 常见问题

### Q1: 树莓派上 YAMNet 推理太慢怎么办？

**A**: 
- 使用量化模型（推理速度快 2-3 倍）
- 减少音频采样率（从 16kHz 降至 8kHz）
- 使用多线程并行处理
- 考虑使用 Edge TPU 加速器

### Q2: 误报率太高怎么办？

**A**:
- 提高置信度阈值（从 0.6 改为 0.7 或 0.8）
- 使用多个模型的集成预测
- 收集误报数据，用于微调模型
- 添加上下文信息（如时间、地点）进行二次判断

### Q3: 网络连接不稳定怎么办？

**A**:
- 实现本地缓存和离线模式
- 使用消息队列（如 RabbitMQ）确保可靠传输
- 添加重试机制和指数退避
- 监控网络连接状态

### Q4: 如何更新模型？

**A**:
- 定期下载最新的 YAMNet 模型
- 在后台更新，不中断服务
- 使用 A/B 测试对比新旧模型
- 收集用户反馈进行模型微调

## 测试

### 1. 单元测试

```python
def test_yamnet_analysis():
    """测试 YAMNet 分析"""
    # 加载测试音频
    audio = load_test_audio('fall_sound.wav')
    
    # 分析
    result = analyze_audio(audio)
    
    # 验证
    assert result['eventType'] == 'fall'
    assert result['confidence'] > 0.6
```

### 2. 集成测试

```bash
# 使用真实音频文件测试
python3 -m pytest test_yamnet_integration.py -v
```

### 3. 性能测试

```bash
# 测试推理时间
time python3 -c "from yamnet import analyze_audio; analyze_audio('test.wav')"
```

## 部署检查清单

- [ ] 树莓派硬件配置完成
- [ ] YAMNet 模型下载并验证
- [ ] Python 依赖全部安装
- [ ] 环境变量配置正确
- [ ] 后端 API 接口已实现
- [ ] 前端上传功能已集成
- [ ] systemd 服务已配置
- [ ] 日志输出正常
- [ ] 网络连接测试通过
- [ ] 端到端测试成功

## 监控和维护

### 1. 日志监控

```bash
# 查看实时日志
sudo journalctl -u yamnet-monitor -f

# 查看历史日志
sudo journalctl -u yamnet-monitor --since "2 hours ago"
```

### 2. 性能监控

```bash
# 监控 CPU 和内存使用
top -p $(pgrep -f yamnet-monitor)

# 监控网络连接
netstat -an | grep 3000
```

### 3. 定期维护

- 每周检查日志，查找错误
- 每月更新系统和依赖
- 每季度评估模型准确率
- 每年进行完整的系统审计

## 参考资源

- [YAMNet GitHub](https://github.com/tensorflow/models/tree/master/research/audio_recognition)
- [TensorFlow Lite 文档](https://www.tensorflow.org/lite)
- [树莓派官方文档](https://www.raspberrypi.org/documentation/)
- [ReSpeaker 文档](https://wiki.seeedstudio.com/ReSpeaker_4-Mic_Array_for_Raspberry_Pi/)

## 支持

如有问题，请：
1. 查看日志文件
2. 检查网络连接
3. 验证配置参数
4. 联系技术支持
