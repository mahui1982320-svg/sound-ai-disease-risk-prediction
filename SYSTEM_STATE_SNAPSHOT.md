# 居家老人安全监测系统 — 系统状态快照

> **快照时间：2026-03-20 16:50 CST**
> **状态：全链路正常运行（树莓派 → 云端 → 网页管理界面）**

本文档记录了系统在正常运行状态下的所有关键配置。当树莓派重启后，系统应自动恢复到此状态，无需任何手动调试。如果出现异常，请对照本文档逐项排查。

---

## 1. 系统架构概览

```
┌─────────────────────────────────────┐
│  树莓派 4B (10.132.182.228)         │
│  reSpeaker XVF3800 4-Mic Array      │
│  ↓ arecord (hw:2,0)                │
│  ↓ YAMNet TFLite 推理               │
│  ↓ HTTP POST (tRPC)                │
└──────────────┬──────────────────────┘
               │ 互联网
┌──────────────▼──────────────────────┐
│  云端 Web 平台                       │
│  https://eldersafe-fv6io3sc.manus.space │
│  ↓ 接收事件 → 存入数据库             │
│  ↓ 网页管理界面实时展示               │
└─────────────────────────────────────┘
```

---

## 2. 树莓派端配置

### 2.1 硬件信息

| 项目 | 值 |
|------|-----|
| 设备 | Raspberry Pi 4B |
| 局域网 IP | 10.132.182.228 |
| 麦克风 | reSpeaker XVF3800 4-Mic Array |
| ALSA 设备 | card 2, device 0 (`hw:2,0`) |
| USB 音频 | USB Audio [USB Audio] |

### 2.2 关键文件路径

| 文件 | 路径 | 说明 |
|------|------|------|
| 主脚本 | `/home/pi/yamnet_uploader.py` | YAMNet 推理 + 上报脚本 |
| YAMNet 模型 | `/home/pi/yamnet.tflite` | TFLite 模型文件 |
| Python 虚拟环境 | `/home/pi/yamnet_venv/` | 包含所有依赖 |
| systemd 服务 | `/etc/systemd/system/yamnet-monitor.service` | 开机自启服务 |
| 服务日志 | `/var/log/yamnet-monitor.log` | 运行日志 |
| 脚本日志 | `/home/pi/yamnet_uploader.log` | Python 脚本自身日志 |
| 临时录音 | `/tmp/yamnet_chunk.wav` | 每次录音的临时 WAV 文件 |

### 2.3 脚本版本

| 项目 | 值 |
|------|-----|
| MD5 校验值 | `cf7fbcfc792a548351585bb0b058ac76` |
| 下载地址 | `https://files.manuscdn.com/user_upload_by_module/session_file/310519663273233586/OOuAyFfAtSyzrowC.py` |
| 更新日期 | 2026-03-22 |
| 主要变更 | 1) RMS_TRIGGER=0.02 过滤底噪; 2) 黑名单过滤 Whale vocalization; 3) _wait_for_mic_ready() 冷启动就绪等待 |

### 2.4 Python 依赖版本

| 包名 | 版本 |
|------|------|
| numpy | 1.26.4 |
| requests | 2.32.5 |
| scipy | 1.17.1 |
| tflite-runtime | 2.14.0 |

### 2.5 systemd 服务配置

```ini
[Unit]
Description=居家老人安全监测 — YAMNet 声音识别上报服务
Documentation=https://eldersafe-fv6io3sc.manus.space
# 等待网络和音频设备就绪后再启动
After=network-online.target sound.target
Wants=network-online.target
# 最多重试 5 次，之后等 5 分钟再试
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi

# 主程序命令
ExecStart=/home/pi/yamnet_venv/bin/python3 /home/pi/yamnet_uploader.py \
    --device-id rpi-001 \
    --api-token 116b9075617e5a0f5a2591ca967d93e68ba321063e5d03d1773a3fd53202d470 \
    --server-url https://eldersafe-fv6io3sc.manus.space \
    --model /home/pi/yamnet.tflite \
    --mic-device 3

# 异常退出后 10 秒自动重启
Restart=on-failure
RestartSec=10

# 标准输出和错误都写入日志
StandardOutput=append:/var/log/yamnet-monitor.log
StandardError=append:/var/log/yamnet-monitor.log

# 环境变量
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

**关键参数说明：**

| 参数 | 值 | 说明 |
|------|-----|------|
| `--device-id` | `rpi-001` | 在云端注册的设备 ID |
| `--api-token` | `116b9075...d470` | 设备认证令牌 |
| `--server-url` | `https://eldersafe-fv6io3sc.manus.space` | 云端平台地址 |
| `--model` | `/home/pi/yamnet.tflite` | 模型文件路径 |
| `--mic-device` | `3` | 麦克风设备索引（已不再使用 sounddevice，此参数被忽略） |

### 2.6 音频处理流水线（核心，已验证）

这是消除"鲸鱼叫声"误检的关键流水线，**7 个步骤缺一不可**：

| 步骤 | 操作 | 代码 | 说明 |
|------|------|------|------|
| 1 | arecord 录音 | `arecord -D hw:2,0 -f S16_LE -r 16000 -c 2 -d 2` | 2秒，16kHz，立体声 |
| 2 | 提取通道 0 | `pcm_all[0::2]` | 交错立体声取左声道 |
| 3 | 转 float32 | `pcm / 32768.0` | int16 → float32 归一化 |
| 4 | 提取非零样本 | `pcm[pcm != 0]` | reSpeaker 稀疏格式，每24帧1个有效样本 |
| 5 | 重采样 | `scipy.signal.resample(nz, 15600)` | ~667Hz → 15600 样本（YAMNet 输入） |
| 6 | **去 DC 偏移** | `audio = audio - np.mean(audio)` | **关键！消除鲸鱼叫声误检** |
| 7 | **归一化** | `audio = audio / np.max(np.abs(audio))` | 归一化到 ±1.0 |

### 2.7 服务自启动状态

| 项目 | 状态 |
|------|------|
| enabled | 是（开机自启） |
| Active | active (running) |
| Restart | on-failure（异常退出 10 秒后自动重启） |
| StartLimitBurst | 5 次（300 秒内最多重试 5 次） |

---

## 3. 云端 Web 平台配置

| 项目 | 值 |
|------|-----|
| 域名 | `https://eldersafe-fv6io3sc.manus.space` |
| 项目名 | `elderly_safety_monitor` |
| 项目 ID | `fV6io3SCve4AEG4kcuBVZn` |
| 最新版本 | `70fdf71c` |
| 功能 | db, server, user |
| 状态 | running |

---

## 4. 开机后自动恢复机制

树莓派开机后，系统会按以下顺序自动恢复：

1. **systemd** 启动 `yamnet-monitor.service`（`WantedBy=multi-user.target`，开机自启）
2. 服务等待 **网络就绪**（`After=network-online.target`）和 **音频设备就绪**（`After=sound.target`）
3. 脚本启动后自动 **检测 ALSA 设备**（搜索 `/proc/asound/cards` 中的 `xvf`/`respeaker`）
4. 发送 **心跳** 到云端，获取最新配置（置信度阈值等）
5. 进入 **主循环**：录音 → 推理 → 上报，每 ~2.5 秒一轮
6. 如果脚本异常退出，systemd 会在 **10 秒后自动重启**

**正常情况下，开机后无需任何手动操作。**

---

## 5. 故障排查速查表

| 症状 | 可能原因 | 解决方法 |
|------|----------|----------|
| 服务未启动 | systemd 未 enable | `sudo systemctl enable yamnet-monitor.service` |
| 持续出现 Whale vocalization (>90%) | 脚本版本错误，缺少 DC 偏移去除 | 重新下载正确版本的脚本（见 2.3 节） |
| arecord 失败 | reSpeaker USB 未识别 | 拔插 USB，检查 `arecord -l` |
| 心跳失败 | 网络未连接 | 检查网络，`ping eldersafe-fv6io3sc.manus.space` |
| 全部 Skipped (silence) | 麦克风无声音输入 | 检查 reSpeaker 连接，`arecord -D hw:2,0 -f S16_LE -r 16000 -c 2 -d 2 /tmp/test.wav` |
| 服务反复重启 | 脚本报错 | 查看日志 `tail -50 /var/log/yamnet-monitor.log` |

---

## 6. 常用运维命令

```bash
# 查看服务状态
systemctl status yamnet-monitor.service

# 查看实时日志
journalctl -u yamnet-monitor -f --no-pager

# 查看脚本日志
tail -100 /var/log/yamnet-monitor.log

# 重启服务
sudo systemctl restart yamnet-monitor.service

# 停止服务
sudo systemctl stop yamnet-monitor.service

# 手动运行脚本（调试用）
cd /home/pi
~/yamnet_venv/bin/python3 yamnet_uploader.py \
    --device-id rpi-001 \
    --api-token 116b9075617e5a0f5a2591ca967d93e68ba321063e5d03d1773a3fd53202d470 \
    --server-url https://eldersafe-fv6io3sc.manus.space \
    --model /home/pi/yamnet.tflite

# 验证脚本版本
md5sum /home/pi/yamnet_uploader.py
# 应输出: 160e79ec7d015665ab8406d431082a0c

# 测试录音是否正常
arecord -D hw:2,0 -f S16_LE -r 16000 -c 2 -d 2 /tmp/test.wav && ls -la /tmp/test.wav

# 检查 reSpeaker 是否被识别
arecord -l | grep -i respeaker
```

---

## 7. 脚本更新方法

如果未来需要更新脚本，执行以下步骤：

```bash
# 1. 备份当前脚本
cp /home/pi/yamnet_uploader.py /home/pi/yamnet_uploader.py.bak

# 2. 下载新脚本（替换 URL 为新版本地址）
wget -O /home/pi/yamnet_uploader.py "<新版本URL>"

# 3. 验证 MD5（与提供的校验值对比）
md5sum /home/pi/yamnet_uploader.py

# 4. 重启服务
sudo systemctl restart yamnet-monitor.service

# 5. 查看日志确认正常
journalctl -u yamnet-monitor -f --no-pager
```

---

## 8. 历史问题记录

| 日期 | 问题 | 根因 | 解决方案 |
|------|------|------|----------|
| 2026-03-19 | YAMNet 持续识别为 Whale vocalization (96.9%) | sounddevice/PortAudio 返回 USB 帧计数器而非真实音频 | 改用 ALSA arecord 直接录音 |
| 2026-03-19 | 改用 arecord 后仍出现 Whale vocalization | reSpeaker 稀疏采样格式引入 DC 偏置 | 添加 DC 偏移去除（`audio - mean`）+ 归一化 |
| 2026-03-20 | 开机后脚本版本回退到旧版 | 之前只在手动测试中验证，未更新 systemd 使用的脚本文件 | 下载最新脚本到 `/home/pi/yamnet_uploader.py` 并重启服务 |
| 2026-03-22 | 重启后 Whale vocalization 误检再次出现 | USB 设备号变化（hw:2,0→hw:1,0），find_alsa_device() 检测正确，但 reSpeaker XVF3800 冷启动时输出固定底噪（RMS=0.0135/0.0140，不随声音变化），YAMNet 将此底噪分类为 Whale vocalization | 1) 提高 RMS_TRIGGER 至 0.02 过滤底噪；2) 加入音频就绪等待：连续采集直到 RMS 出现变化（标准差>0.001）才开始推理 |
| 2026-03-22 | 黑名单过滤后仍全部 Skipped (silence) | RMS_TRIGGER=0.02 正确过滤了底噪，但说话时 RMS 仍不变（还是0.0135），说明 reSpeaker 冷启动期间麦克风未真正就绪，需要等待设备初始化完成 | 脚本启动时循环录音检测 RMS 变化，直到 RMS 出现波动（说明麦克风真正就绪）再进入主循环 |

---

## 9. reSpeaker XVF3800 关键特性（已验证）

| 特性 | 描述 |
|------|------|
| 稀疏采样格式 | 48000 个样本中只有约 2000 个非零（4.2%），每24帧1个有效样本 |
| 冷启动底噪 | 刚启动时输出固定底噪：CH0 RMS≈0.01350，CH1 RMS≈0.01404，**不随声音变化** |
| 就绪标志 | 当 RMS 开始随声音变化时，说明麦克风真正就绪 |
| 通道数 | `-c 2` 立体声，CH0 有信号，CH1 全零（正常现象） |
| 设备号不固定 | 重启后 card 号可能变化（2→1），但 `find_alsa_device()` 能自动检测 |
| DC 偏置 | 稀疏格式会引入 DC 偏置，必须做 `audio - mean` 去除，否则 YAMNet 识别为 Whale vocalization |

**正确的音频处理流水线（7步，缺一不可）：**

```
1. arecord -D hw:X,0 -f S16_LE -r 16000 -c 2 -d 2   → 2秒立体声录音
2. pcm_all[0::2]                                      → 取 CH0（交错立体声左声道）
3. pcm / 32768.0                                      → int16 → float32
4. pcm[pcm != 0]                                      → 提取非零样本（稀疏格式）
5. scipy.signal.resample(nz, 15600)                   → 重采样到 YAMNet 输入长度
6. audio = audio - np.mean(audio)                     → 去 DC 偏移（关键！）
7. audio = audio / np.max(np.abs(audio))              → 归一化到 ±1.0
```

**RMS 阈值：**
- 底噪 RMS：0.0135~0.0140（固定，不随声音变化）
- RMS_TRIGGER = 0.02（过滤底噪）
- 真实声音 RMS：> 0.05

---

> **重要提醒：** 树莓派开机后，`yamnet-monitor.service` 会自动启动。正常情况下无需任何手动操作。如果发现异常，请先查看日志（`journalctl -u yamnet-monitor -f`），然后对照本文档第 5 节排查。
