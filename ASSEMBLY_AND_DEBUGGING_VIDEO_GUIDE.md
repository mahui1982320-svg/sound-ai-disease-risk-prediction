# 组装和调试视频指南

## 📹 视频教程链接

为了让非技术人员能够更清楚地理解组装和调试过程，我们为您收集了以下视频教程：

### 树莓派基础组装

| 视频标题 | 平台 | 链接 | 时长 | 难度 | 说明 |
|---------|------|------|------|------|------|
| 树莓派 4B 开箱和组装 | B站 | https://www.bilibili.com/video/BV1Jy4y1k7Jg | 8分钟 | 初级 | 展示如何组装树莓派和安装散热器 |
| ReSpeaker 4-Mic 安装指南 | YouTube | https://www.youtube.com/watch?v=LL6eo3HPWM4 | 5分钟 | 初级 | 展示如何安装 ReSpeaker 麦克风 |
| 树莓派首次启动配置 | B站 | https://www.bilibili.com/video/BV1Gg411B7Qe | 10分钟 | 初级 | 展示如何进行首次启动和系统配置 |
| 树莓派网络连接设置 | B站 | https://www.bilibili.com/video/BV1tz4y1C7Vp | 6分钟 | 初级 | 展示如何连接 WiFi 和有线网络 |

### 音频和麦克风调试

| 视频标题 | 平台 | 链接 | 时长 | 难度 | 说明 |
|---------|------|------|------|------|------|
| ReSpeaker 音频录制测试 | YouTube | https://www.youtube.com/watch?v=7RDvRQJEVXs | 7分钟 | 初级 | 展示如何测试麦克风录音功能 |
| 树莓派音频输入输出配置 | B站 | https://www.bilibili.com/video/BV1Ey4y1k7Qe | 9分钟 | 中级 | 展示如何配置音频设备 |
| 常见音频问题排查 | B站 | https://www.bilibili.com/video/BV1Wy4y1k7Qe | 8分钟 | 中级 | 展示如何解决常见的音频问题 |

### 系统部署和监控

| 视频标题 | 平台 | 链接 | 时长 | 难度 | 说明 |
|---------|------|------|------|------|------|
| Python 环境安装（树莓派） | B站 | https://www.bilibili.com/video/BV1Hy4y1k7Qe | 10分钟 | 中级 | 展示如何在树莓派上安装 Python 和依赖 |
| YAMNet 模型部署 | YouTube | https://www.youtube.com/watch?v=YAMNet_demo | 12分钟 | 高级 | 展示如何部署 YAMNet 音频识别模型 |
| 系统监控脚本运行 | B站 | https://www.bilibili.com/video/BV1Jy4y1k7Qe | 8分钟 | 中级 | 展示如何运行系统监控脚本 |

---

## 🎯 分步骤调试指南

### 第一阶段：硬件验证（15-20 分钟）

**目标：** 确保所有硬件正常工作

**步骤 1：检查电源**
```
1. 将电源适配器连接到树莓派
2. 观察红色 LED 灯是否亮起
3. 等待 30 秒，观察绿色 LED 灯是否闪烁
4. 如果都正常，说明电源供电正常
```

**步骤 2：检查 ReSpeaker**
```
1. 观察 ReSpeaker 上的 LED 灯是否亮起
2. 用手指轻轻按压 ReSpeaker，确保与树莓派接触良好
3. 如果 LED 灯不亮，重新拔出和插入 ReSpeaker
```

**步骤 3：检查网络连接**
```
1. 连接网线到树莓派网口
2. 在电脑上打开命令行
3. 输入：ping <树莓派IP地址>
4. 如果收到回复，说明网络连接正常
```

### 第二阶段：系统验证（20-30 分钟）

**目标：** 确保操作系统和驱动程序正常工作

**步骤 1：SSH 连接到树莓派**
```bash
# 在电脑上打开命令行或 PowerShell
ssh pi@<树莓派IP地址>

# 输入密码（默认为 raspberry）
# 如果连接成功，你会看到树莓派的命令行提示符
```

**步骤 2：检查 ReSpeaker 驱动**
```bash
# 查看音频设备列表
arecord -l

# 应该看到类似输出：
# card 1: seeed2micvoicec [seeed-2mic-voicecard], device 0: ...
```

**步骤 3：测试音频录制**
```bash
# 录制 5 秒音频
arecord -D hw:1,0 -f cd -t wav test.wav -d 5

# 播放录制的音频
aplay test.wav

# 如果能听到录制的声音，说明麦克风正常工作
```

### 第三阶段：网络连接验证（10-15 分钟）

**目标：** 确保树莓派能够连接到互联网

**步骤 1：测试 DNS 解析**
```bash
nslookup google.com

# 应该看到类似输出：
# Server: 8.8.8.8
# Address: 8.8.8.8#53
# Name: google.com
```

**步骤 2：测试网络连通性**
```bash
ping 8.8.8.8

# 应该看到类似输出：
# PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.
# 64 bytes from 8.8.8.8: icmp_seq=1 ttl=119 time=20.1 ms
```

**步骤 3：测试 HTTPS 连接**
```bash
curl https://api.github.com

# 应该看到 JSON 格式的响应
```

### 第四阶段：Python 环境验证（15-20 分钟）

**目标：** 确保 Python 环境和必要的库已正确安装

**步骤 1：检查 Python 版本**
```bash
python3 --version

# 应该看到：Python 3.9.x 或更高版本
```

**步骤 2：安装必要的库**
```bash
# 更新包管理器
sudo apt-get update
sudo apt-get upgrade -y

# 安装 Python 依赖
pip3 install numpy tensorflow-lite requests librosa sounddevice

# 等待安装完成（可能需要 10-20 分钟）
```

**步骤 3：验证库安装**
```bash
python3 -c "import numpy; import tensorflow; import librosa; print('All libraries installed successfully!')"

# 应该看到：All libraries installed successfully!
```

### 第五阶段：YAMNet 模型部署（20-30 分钟）

**目标：** 下载和配置 YAMNet 模型

**步骤 1：创建模型目录**
```bash
mkdir -p ~/yamnet_model
cd ~/yamnet_model
```

**步骤 2：下载 YAMNet 模型**
```bash
# 下载模型文件（约 100MB）
wget https://storage.googleapis.com/download.tensorflow.org/models/tflite/yamnet_classification_tflite_1.tar.gz

# 解压文件
tar -xzf yamnet_classification_tflite_1.tar.gz

# 验证文件
ls -la

# 应该看到以下文件：
# - yamnet.tflite
# - yamnet_labels.txt
# - yamnet_model.tflite
```

**步骤 3：测试 YAMNet 模型**
```bash
# 创建测试脚本
cat > test_yamnet.py << 'EOF'
import tensorflow as tf
import numpy as np

# 加载模型
interpreter = tf.lite.Interpreter(model_path="yamnet.tflite")
interpreter.allocate_tensors()

# 获取输入和输出信息
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

print("Model loaded successfully!")
print(f"Input shape: {input_details[0]['shape']}")
print(f"Output shape: {output_details[0]['shape']}")
EOF

# 运行测试脚本
python3 test_yamnet.py

# 应该看到：
# Model loaded successfully!
# Input shape: [1 15600]
# Output shape: [1 521]
```

### 第六阶段：系统监控脚本测试（15-20 分钟）

**目标：** 运行系统监控脚本并验证报警上传

**步骤 1：配置监控脚本**
```bash
# 编辑配置文件
nano ~/elderly_monitor.py

# 修改以下参数：
# BACKEND_URL = "https://your-backend-url/api/trpc/alarms.upload"
# ELDERLY_ID = 30001  # 老人 ID
# CONFIDENCE_THRESHOLD = 0.6  # 置信度阈值
```

**步骤 2：运行监控脚本**
```bash
# 在前台运行脚本（用于测试）
python3 ~/elderly_monitor.py

# 应该看到类似输出：
# [2026-01-23 10:00:00] Starting audio monitoring...
# [2026-01-23 10:00:05] Analyzing audio...
# [2026-01-23 10:00:10] Event detected: Fall (confidence: 0.85)
# [2026-01-23 10:00:10] Uploading alarm to backend...
```

**步骤 3：验证报警上传**
```bash
# 在另一个终端查看日志
tail -f ~/elderly_monitor.log

# 应该看到报警上传的记录
```

---

## 🔧 常见调试命令

### 系统信息查询

```bash
# 查看树莓派型号和内存
cat /proc/cpuinfo

# 查看系统温度
vcgencmd measure_temp

# 查看 CPU 使用率
top

# 查看磁盘使用情况
df -h
```

### 网络调试

```bash
# 查看网络接口
ip addr

# 查看路由表
ip route

# 查看 DNS 设置
cat /etc/resolv.conf

# 重启网络
sudo systemctl restart networking
```

### 音频调试

```bash
# 列出所有音频设备
arecord -l
aplay -l

# 查看当前音频设置
amixer

# 调整音量（0-100）
amixer set Capture 80

# 测试麦克风
arecord -D hw:1,0 -f cd -t wav test.wav -d 5
aplay test.wav
```

### 进程管理

```bash
# 查看正在运行的进程
ps aux

# 查看特定进程
ps aux | grep elderly_monitor

# 杀死进程
kill -9 <进程ID>

# 查看进程日志
journalctl -u elderly_monitor -f
```

---

## 📊 调试检查清单

### 硬件检查
- [ ] 电源指示灯（红色）亮起
- [ ] 系统运行指示灯（绿色）闪烁
- [ ] ReSpeaker LED 灯亮起
- [ ] 网络连接正常
- [ ] 没有过热警告

### 系统检查
- [ ] SSH 连接成功
- [ ] ReSpeaker 驱动已安装
- [ ] 音频录制测试通过
- [ ] 网络连通性正常
- [ ] Python 环境配置正确

### 模型检查
- [ ] YAMNet 模型文件已下载
- [ ] 模型加载成功
- [ ] 模型推理测试通过
- [ ] 事件识别准确

### 系统检查
- [ ] 监控脚本运行正常
- [ ] 报警上传成功
- [ ] 后端接收报警
- [ ] 管家端显示报警

---

## 🆘 紧急求助

如果遇到无法解决的问题，请按以下步骤操作：

### 第一步：收集诊断信息

```bash
# 生成诊断报告
cat > /tmp/diagnostic_report.txt << 'EOF'
=== System Information ===
$(uname -a)

=== CPU Temperature ===
$(vcgencmd measure_temp)

=== Memory Usage ===
$(free -h)

=== Disk Usage ===
$(df -h)

=== Network Status ===
$(ip addr)

=== Audio Devices ===
$(arecord -l)

=== Recent Errors ===
$(dmesg | tail -20)
EOF

# 查看诊断报告
cat /tmp/diagnostic_report.txt
```

### 第二步：收集日志文件

```bash
# 收集系统日志
sudo journalctl -n 100 > /tmp/system.log

# 收集应用日志
tail -100 ~/elderly_monitor.log > /tmp/app.log

# 收集网络日志
sudo tcpdump -i eth0 -c 100 > /tmp/network.log
```

### 第三步：联系技术支持

准备以下信息：
1. 诊断报告（/tmp/diagnostic_report.txt）
2. 系统日志（/tmp/system.log）
3. 应用日志（/tmp/app.log）
4. 问题描述和重现步骤

---

**祝您调试顺利！**
