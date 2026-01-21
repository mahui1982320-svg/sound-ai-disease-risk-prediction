# 硬件端集成指南

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    树莓派 4B / Orange Pi 5                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           ReSpeaker 4-Mic Array                      │  │
│  │  (声源定位、回声消除、噪音抑制)                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      音频预处理 (背景噪音去除)                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      YAMNet 模型推理 (边缘计算)                      │  │
│  │  判断是否为危险声音 (摔倒/尖叫/咳嗽/呻吟)            │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   置信度 > 0.6？                                      │  │
│  │   是 → 上传音频 + HTTP 请求到云端                    │  │
│  │   否 → 继续监听                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │   云端数据库 + 管家端推送通知                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 硬件清单

| 组件 | 型号 | 成本 | 用途 |
|------|------|------|------|
| 主控板 | 树莓派 4B 或 Orange Pi 5 | ¥200-300 | 运行YAMNet模型，处理音频 |
| 麦克风阵列 | ReSpeaker 4-Mic Array | ¥200-300 | 采集音频，声源定位 |
| 电源 | USB-C 5V 3A | ¥50-100 | 供电 |
| 存储 | microSD 64GB | ¥50-100 | 系统和模型存储 |
| **总成本** | | **¥500-800** | |

## 软件环境搭建

### 1. 树莓派系统安装

```bash
# 使用 Raspberry Pi Imager 烧录 Raspberry Pi OS (Lite)
# https://www.raspberrypi.com/software/

# 首次启动后更新系统
sudo apt update
sudo apt upgrade -y

# 安装必要的依赖
sudo apt install -y python3-pip python3-dev
sudo apt install -y libatlas-base-dev libjasper-dev libtiff5 libjasper1 libharfbuzz0b libwebp6
sudo apt install -y libopenjp2-7 libtiff5 libopenjp2-7-dev libtiff-dev libharfbuzz0b libwebp6
```

### 2. 安装 ReSpeaker 驱动

```bash
# 克隆 ReSpeaker 仓库
git clone https://github.com/respeaker/seeed-voicecard.git
cd seeed-voicecard

# 安装驱动
sudo bash install.sh

# 重启
sudo reboot

# 验证安装
arecord -L | grep seeed
```

### 3. 安装 Python 依赖

```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install --upgrade pip
pip install numpy scipy matplotlib
pip install tensorflow-lite-runtime
pip install requests
pip install librosa
pip install soundfile
```

### 4. 下载 YAMNet 模型

```bash
# 创建模型目录
mkdir -p ~/models

# 下载 YAMNet 模型
cd ~/models
wget https://storage.googleapis.com/yamnet/classification_model_with_metadata.tflite
wget https://storage.googleapis.com/yamnet/yamnet_model_metadata.json
```

## 硬件端代码示例

### 完整的监听和上报脚本

```python
#!/usr/bin/env python3
"""
养老院智能报警系统 - 硬件端监听脚本
在树莓派上运行，持续监听音频并上报危险声音
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

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 配置参数
CONFIG = {
    "api_url": "https://your-app.manus.space",
    "elderly_id": 1,
    "room_number": "101",
    "sample_rate": 16000,
    "chunk_duration": 1.0,  # 秒
    "confidence_threshold": 0.6,
    "audio_duration": 10,  # 保存10秒音频
    "oss_bucket": "https://oss.example.com",
}

# YAMNet 标签映射
YAMNET_LABELS = {
    "Scream": "scream",
    "Moan": "moan",
    "Cough": "cough",
    "Thud": "fall",
}

class AudioMonitor:
    def __init__(self, config):
        self.config = config
        self.is_running = False
        self.audio_buffer = []
        self.last_alarm_time = 0
        self.alarm_cooldown = 30  # 30秒内不重复上报
        
        # 初始化 TFLite 解释器
        self._init_tflite()
    
    def _init_tflite(self):
        """初始化 TensorFlow Lite 解释器"""
        try:
            import tflite_runtime.interpreter as tflite
            model_path = os.path.expanduser("~/models/classification_model_with_metadata.tflite")
            self.interpreter = tflite.Interpreter(model_path=model_path)
            self.interpreter.allocate_tensors()
            logger.info("YAMNet 模型加载成功")
        except Exception as e:
            logger.error(f"模型加载失败: {e}")
            sys.exit(1)
    
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
    
    def _infer_yamnet(self, audio_data):
        """使用 YAMNet 进行推理"""
        try:
            # 重采样到 16kHz
            if len(audio_data) > 0:
                # 获取输入和输出张量
                input_details = self.interpreter.get_input_details()
                output_details = self.interpreter.get_output_details()
                
                # 准备输入
                audio_input = np.array([audio_data], dtype=np.float32)
                self.interpreter.set_tensor(input_details[0]['index'], audio_input)
                
                # 运行推理
                self.interpreter.invoke()
                
                # 获取输出
                scores = self.interpreter.get_tensor(output_details[0]['index'])
                
                return scores
        except Exception as e:
            logger.error(f"推理失败: {e}")
            return None
    
    def _upload_alarm(self, event_type, confidence, audio_url):
        """上传报警数据到云端"""
        try:
            payload = {
                "elderlyId": self.config["elderly_id"],
                "eventType": event_type,
                "confidenceScore": int(confidence * 100),
                "audioUrl": audio_url
            }
            
            response = requests.post(
                f"{self.config['api_url']}/api/trpc/alarms.upload",
                json=payload,
                timeout=10
            )
            
            if response.status_code == 200:
                logger.info(f"报警上传成功: {event_type}, 置信度: {confidence:.2f}")
                return True
            else:
                logger.error(f"上传失败: {response.status_code}")
                return False
        except Exception as e:
            logger.error(f"上传异常: {e}")
            return False
    
    def _save_and_upload_audio(self, audio_data, event_type, confidence):
        """保存音频并上传到 OSS"""
        try:
            # 生成文件名
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{timestamp}_{self.config['room_number']}_{event_type}.wav"
            
            # 保存本地
            local_path = f"/tmp/{filename}"
            sf.write(local_path, audio_data, self.config["sample_rate"])
            
            # 上传到 OSS（这里需要配置 OSS 凭证）
            # 示例：使用 oss2 库上传
            audio_url = f"{self.config['oss_bucket']}/alarms/{filename}"
            
            logger.info(f"音频已保存: {audio_url}")
            
            # 上传报警
            self._upload_alarm(event_type, confidence, audio_url)
        except Exception as e:
            logger.error(f"保存/上传音频失败: {e}")
    
    def _detect_alarm(self):
        """检测危险声音"""
        while self.is_running:
            try:
                # 录制 1 秒音频
                audio_data = self._record_audio(1.0)
                if audio_data is None:
                    continue
                
                # 推理
                scores = self._infer_yamnet(audio_data)
                if scores is None:
                    continue
                
                # 检查是否有危险声音
                current_time = time.time()
                for label, event_type in YAMNET_LABELS.items():
                    # 这里需要根据 YAMNet 的实际输出格式调整
                    # 假设 scores 包含各个标签的置信度
                    confidence = 0.5  # 示例值
                    
                    if confidence > self.config["confidence_threshold"]:
                        # 检查冷却时间
                        if current_time - self.last_alarm_time > self.alarm_cooldown:
                            logger.warning(f"检测到危险声音: {label}, 置信度: {confidence:.2f}")
                            
                            # 录制 10 秒音频
                            alarm_audio = self._record_audio(self.config["audio_duration"])
                            if alarm_audio is not None:
                                self._save_and_upload_audio(alarm_audio, event_type, confidence)
                            
                            self.last_alarm_time = current_time
                
                # 短暂延迟，避免 CPU 过载
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
        
        # 在后台线程中运行
        monitor_thread = Thread(target=self._detect_alarm, daemon=True)
        monitor_thread.start()
    
    def stop(self):
        """停止监听"""
        self.is_running = False
        logger.info("停止音频监听")

def main():
    monitor = AudioMonitor(CONFIG)
    
    try:
        monitor.start()
        logger.info("系统运行中，按 Ctrl+C 退出")
        
        # 保持运行
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("收到退出信号")
        monitor.stop()
        sys.exit(0)

if __name__ == "__main__":
    main()
```

### 使用方法

```bash
# 1. 修改配置参数
# 编辑脚本中的 CONFIG 字典，设置 api_url、elderly_id 等

# 2. 运行脚本
python3 alarm_monitor.py

# 3. 后台运行（可选）
nohup python3 alarm_monitor.py > alarm_monitor.log 2>&1 &

# 4. 查看日志
tail -f alarm_monitor.log
```

## 故障排查

### 1. 麦克风无法识别

```bash
# 检查 USB 设备
lsusb | grep -i respeaker

# 检查音频设备
arecord -L

# 重新安装驱动
cd ~/seeed-voicecard
sudo bash install.sh
sudo reboot
```

### 2. 模型推理缓慢

- 确保使用 TensorFlow Lite Runtime（而不是完整的 TensorFlow）
- 考虑使用量化模型以提高推理速度
- 可选：使用 Google Coral TPU 加速推理

### 3. 网络连接问题

```bash
# 测试网络连接
curl -I https://your-app.manus.space

# 检查 DNS
nslookup your-app.manus.space

# 查看网络状态
ifconfig
```

## 性能优化建议

1. **音频缓冲**：使用环形缓冲区减少内存占用
2. **模型优化**：使用量化模型或蒸馏模型
3. **异步上报**：在后台线程中上报数据，避免阻塞主线程
4. **本地缓存**：网络不可用时本地缓存报警数据

## 安全建议

1. **HTTPS**：始终使用 HTTPS 连接
2. **身份验证**：考虑为硬件端添加 API Key 认证
3. **数据加密**：对敏感数据进行加密
4. **日志记录**：记录所有上报事件用于审计

## 支持

如有任何问题，请参考 ReSpeaker 官方文档：
- https://wiki.seeedstudio.com/ReSpeaker_4-Mic_Array_for_Raspberry_Pi/
- https://github.com/respeaker/seeed-voicecard

或联系开发团队获取技术支持。
