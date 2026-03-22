# 居家老人安全监测系统 — 系统状态快照

> **快照时间：2026-03-22 16:00 CST**
> **状态：全链路正常运行（树莓派 → 云端 → 网页管理界面）**
> **脚本版本：c3d5a26681cedb44012f9533d295ab87（2026-03-22 最终版）**

本文档是系统的**唯一权威知识库**。记录了所有已验证的配置、根本原因分析和修复代码。
遇到任何问题，请先查本文档，**不要重复调试已解决的问题**。

---

## 1. 系统架构概览

```
┌─────────────────────────────────────┐
│  树莓派 4B (192.168.0.113)          │
│  reSpeaker XVF3800 4-Mic Array      │
│  ↓ USB 软重置（开机自动执行）        │
│  ↓ arecord (hw:X,0，动态检测)       │
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
| 局域网 IP | 192.168.0.113 |
| 麦克风 | reSpeaker XVF3800 4-Mic Array |
| USB Vendor:Product | 2886:001a (Seeed Technology Co., Ltd.) |
| ALSA 设备 | **动态检测**（重启后 card 号可能变化，脚本自动适应） |

### 2.2 关键文件路径

| 文件 | 路径 | 说明 |
|------|------|------|
| 主脚本 | `/home/pi/yamnet_uploader.py` | YAMNet 推理 + 上报脚本 |
| YAMNet 模型 | `/home/pi/yamnet.tflite` | TFLite 模型文件 |
| Python 虚拟环境 | `/home/pi/yamnet_venv/` | 包含所有依赖 |
| systemd 服务 | `/etc/systemd/system/yamnet-monitor.service` | 开机自启服务 |
| 服务日志 | `/var/log/yamnet-monitor.log` | 运行日志（Python 脚本输出） |

### 2.3 脚本版本（最终版）

| 项目 | 值 |
|------|-----|
| MD5 校验值 | `c3d5a26681cedb44012f9533d295ab87` |
| 下载地址 | `https://files.manuscdn.com/user_upload_by_module/session_file/310519663273233586/ivQLMjmaVCSMwxFq.py` |
| 更新日期 | 2026-03-22 |
| 包含修复 | USB 软重置 + RMS 阈值 + 黑名单过滤 + 就绪等待 |

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
After=network-online.target sound.target
Wants=network-online.target
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
User=root
WorkingDirectory=/home/pi

ExecStart=/home/pi/yamnet_venv/bin/python3 /home/pi/yamnet_uploader.py \
    --device-id rpi-001 \
    --api-token 116b9075617e5a0f5a2591ca967d93e68ba321063e5d03d1773a3fd53202d470 \
    --server-url https://eldersafe-fv6io3sc.manus.space \
    --model /home/pi/yamnet.tflite

Restart=on-failure
RestartSec=10
StandardOutput=append:/var/log/yamnet-monitor.log
StandardError=append:/var/log/yamnet-monitor.log
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

> **重要：** `User=root` 是必须的，因为 USB 软重置需要写入 `/sys/bus/usb/devices/*/authorized`，pi 用户没有权限。

### 2.6 关键参数说明

| 参数 | 值 | 说明 |
|------|-----|------|
| `--device-id` | `rpi-001` | 在云端注册的设备 ID |
| `--api-token` | `116b9075...d470` | 设备认证令牌 |
| `--server-url` | `https://eldersafe-fv6io3sc.manus.space` | 云端平台地址 |
| `--model` | `/home/pi/yamnet.tflite` | 模型文件路径 |

---

## 3. reSpeaker XVF3800 关键特性（已验证）

这是本项目最重要的知识，花了3天时间才完全摸清。

### 3.1 硬件特性

| 特性 | 描述 |
|------|------|
| USB Vendor:Product | `2886:001a` |
| 稀疏采样格式 | 48000 个样本中只有约 2000 个非零（4.2%），每24帧1个有效样本 |
| 通道数 | 必须用 `-c 2`（立体声），不支持 `-c 1`；CH0 有信号，CH1 全零（正常现象） |
| 设备号不固定 | 重启后 card 号可能变化（如 hw:2,0 → hw:1,0），必须动态检测 |

### 3.2 冷启动固件问题（根本原因）

**现象：** 树莓派重启后，reSpeaker 被正确识别（`arecord -l` 显示正常），但录音输出固定底噪：
- CH0 RMS 永远是 `0.01350` 和 `0.01404` 交替
- 不随外部声音变化（说话、拍手都没有反应）
- YAMNet 将此底噪分类为 `Whale vocalization 98%`

**根本原因：** reSpeaker XVF3800 的 USB DSP 固件在树莓派重启后未完全激活。设备在系统层面存在，但固件处于未初始化状态，只输出固定测试信号。

**验证方法：** 物理重插 USB 后，固件重新初始化，麦克风立即恢复正常。

**软件解决方案：** 通过写入 `/sys/bus/usb/devices/*/authorized` 执行 USB 软重置，等效于物理重插。

### 3.3 正确的音频处理流水线（7步，缺一不可）

| 步骤 | 操作 | 代码 | 说明 |
|------|------|------|------|
| 1 | arecord 录音 | `arecord -D hw:X,0 -f S16_LE -r 16000 -c 2 -d 2` | 2秒，16kHz，立体声 |
| 2 | 提取通道 0 | `pcm_all[0::2]` | 交错立体声取左声道 |
| 3 | 转 float32 | `pcm / 32768.0` | int16 → float32 归一化 |
| 4 | 提取非零样本 | `pcm[pcm != 0]` | reSpeaker 稀疏格式，每24帧1个有效样本 |
| 5 | 重采样 | `scipy.signal.resample(nz, 15600)` | ~667Hz → 15600 样本（YAMNet 输入） |
| 6 | **去 DC 偏移** | `audio = audio - np.mean(audio)` | **关键！消除 Whale vocalization 误检** |
| 7 | **归一化** | `audio = audio / np.max(np.abs(audio))` | 归一化到 ±1.0（仅当 max_amp > 0.1 时执行） |

### 3.4 RMS 阈值参考

| 状态 | ac_rms 范围 | 处理方式 |
|------|------------|---------|
| 固件未激活（冷启动底噪） | 0.01350 / 0.01404 交替，**不变化** | USB 软重置后等待就绪 |
| 安静环境（固件正常） | < 0.005，**有微小波动** | RMS_TRIGGER 过滤，跳过推理 |
| 真实声音（说话/环境音） | > 0.05 | 正常推理并上报 |
| **RMS_TRIGGER 阈值** | **0.02** | 低于此值跳过推理（显示 Silence） |

---

## 4. 脚本核心代码（最终版）

### 4.1 USB 软重置函数

```python
def usb_reset_respeaker() -> bool:
    """
    Soft-reset the reSpeaker XVF3800 USB device.
    Required after reboot: XVF3800 firmware is not activated until USB reset.
    Must run as root (writes to /sys/bus/usb/devices/*/authorized).
    """
    RESPEAKER_VENDOR = "2886"
    RESPEAKER_PRODUCT = "001a"
    try:
        usb_devices_path = Path("/sys/bus/usb/devices")
        for dev_path in usb_devices_path.iterdir():
            id_vendor_file = dev_path / "idVendor"
            id_product_file = dev_path / "idProduct"
            authorized_file = dev_path / "authorized"
            if not (id_vendor_file.exists() and id_product_file.exists()):
                continue
            vendor = id_vendor_file.read_text().strip()
            product = id_product_file.read_text().strip()
            if vendor == RESPEAKER_VENDOR and product == RESPEAKER_PRODUCT:
                log.info("[USB RESET] Found reSpeaker at %s", dev_path.name)
                if authorized_file.exists():
                    authorized_file.write_text("0")   # 断开
                    time.sleep(1)
                    authorized_file.write_text("1")   # 重连
                    time.sleep(3)                      # 等待固件初始化
                    log.info("[USB RESET] USB reset complete")
                    return True
    except PermissionError:
        log.warning("[USB RESET] Permission denied — service must run as root")
    except Exception as exc:
        log.warning("[USB RESET] Failed: %s", exc)
    return False
```

### 4.2 设备动态检测函数

```python
def find_alsa_device() -> str:
    """
    Dynamically detect reSpeaker ALSA device.
    Card number changes after reboot (e.g., hw:2,0 → hw:1,0).
    """
    try:
        cards_text = Path("/proc/asound/cards").read_text()
        for line in cards_text.splitlines():
            line_lower = line.lower()
            if any(k in line_lower for k in ('xvf', 'respeaker', 'array')):
                parts = line.strip().split()
                if parts and parts[0].isdigit():
                    card_num = int(parts[0])
                    device = f"hw:{card_num},0"
                    log.info("reSpeaker detected: ALSA device=%s (card %d)", device, card_num)
                    return device
        # Fallback: parse arecord -l
        result = subprocess.run(["arecord", "-l"], capture_output=True, text=True, timeout=5)
        for line in result.stdout.splitlines():
            if any(k in line.lower() for k in ('xvf', 'respeaker', 'array')):
                import re
                m = re.search(r'card\s+(\d+)', line)
                if m:
                    card_num = int(m.group(1))
                    return f"hw:{card_num},0"
    except Exception as exc:
        log.warning("ALSA device detection failed: %s", exc)
    log.warning("Using fallback ALSA device: hw:2,0")
    return "hw:2,0"
```

### 4.3 AudioStream 初始化（三步流程）

```python
class AudioStream:
    def __init__(self, device_index, sample_rate: int):
        # 步骤1：USB 软重置，激活 XVF3800 固件
        log.info("[USB RESET] Attempting USB soft-reset of reSpeaker XVF3800...")
        reset_ok = usb_reset_respeaker()
        if reset_ok:
            log.info("[USB RESET] Success, waiting 3s for ALSA re-enumeration...")
            time.sleep(3)
        else:
            log.warning("[USB RESET] Failed or skipped, proceeding anyway")

        # 步骤2：动态检测 ALSA 设备号
        self.alsa_device = find_alsa_device()
        self.sample_rate = sample_rate
        log.info("AudioStream ready: ALSA device=%s  sample_rate=%d Hz",
                 self.alsa_device, sample_rate)

        # 步骤3：等待麦克风真正就绪（RMS 出现波动）
        self._wait_for_mic_ready()

    def _wait_for_mic_ready(self, max_attempts: int = 30, stable_threshold: float = 0.001):
        """
        Wait until RMS values show variation (std > threshold).
        Fixed RMS = firmware not ready. Variable RMS = mic is live.
        """
        log.info("[MIC READY] Waiting for reSpeaker cold-start initialization...")
        rms_history = []
        for attempt in range(1, max_attempts + 1):
            try:
                _, ac_rms = record_audio_arecord(self.alsa_device, self.sample_rate)
                rms_history.append(ac_rms)
                if len(rms_history) >= 5:
                    rms_std = float(np.std(rms_history[-5:]))
                    if rms_std > stable_threshold:
                        log.info("[MIC READY] Ready after %d attempts (rms_std=%.5f)",
                                 attempt, rms_std)
                        return
                log.info("[MIC READY] Attempt %d/%d: ac_rms=%.5f (waiting for variation)",
                         attempt, max_attempts, ac_rms)
            except Exception as e:
                log.warning("[MIC READY] Attempt %d failed: %s", attempt, e)
        log.warning("[MIC READY] Not ready after %d attempts, starting anyway", max_attempts)
```

### 4.4 关键常量

```python
RMS_TRIGGER = 0.02    # 低于此值跳过推理（reSpeaker 底噪 ≈ 0.0135~0.0140）

# 家庭环境黑名单：这些声音类别在家庭中不可能出现，一旦识别为这些说明是噪声
HOME_BLACKLIST_CLASS_IDS = {
    132,  # Whale vocalization — reSpeaker 底噪特征，必须过滤
    # 可根据实际环境添加更多
}
```

---

## 5. 开机自动恢复流程

树莓派开机后，系统按以下顺序自动恢复（无需任何手动操作）：

1. **systemd** 启动 `yamnet-monitor.service`（`User=root`，开机自启）
2. 服务等待网络和音频设备就绪
3. 脚本执行 **USB 软重置**（写入 `/sys/bus/usb/devices/*/authorized`），激活 XVF3800 固件
4. 等待 3 秒让 ALSA 重新枚举设备
5. **动态检测 ALSA 设备号**（搜索 `/proc/asound/cards`）
6. **等待麦克风就绪**（检测 RMS 出现波动，通常 5-10 次采集后就绪）
7. 发送**心跳**到云端
8. 进入**主循环**：录音 → 推理 → 上报，每 ~2.5 秒一轮
9. 异常退出后 systemd 在 **10 秒后自动重启**

---

## 6. 故障排查速查表

| 症状 | 根本原因 | 解决方法 |
|------|----------|----------|
| Whale vocalization 持续 98% | USB 固件未激活，脚本版本错误（缺少 USB 重置） | 下载最新脚本（见第2.3节），`User=root` 运行服务 |
| 全部 Skipped (silence)，ac_rms=0.0135 固定不变 | USB 固件未激活（重启后常见） | 确认服务以 root 运行，查看 `[USB RESET]` 日志 |
| `[USB RESET] Permission denied` | 服务以 pi 用户运行 | 将 service 文件中 `User=pi` 改为 `User=root` |
| arecord 失败 `设备或资源忙` | yamnet 服务正在占用设备 | `sudo systemctl stop yamnet-monitor` 后再手动测试 |
| 服务未启动 | systemd 未 enable | `sudo systemctl enable yamnet-monitor.service` |
| 心跳失败 | 网络未连接 | `ping eldersafe-fv6io3sc.manus.space` |
| 服务反复重启 | 脚本报错 | `tail -50 /var/log/yamnet-monitor.log` |

---

## 7. 常用运维命令

```bash
# 查看服务状态
systemctl status yamnet-monitor.service

# 查看实时日志
tail -f /var/log/yamnet-monitor.log

# 重启服务
sudo systemctl restart yamnet-monitor.service

# 验证脚本版本
md5sum /home/pi/yamnet_uploader.py
# 应输出: c3d5a26681cedb44012f9533d295ab87

# 手动运行脚本（调试用，需 root）
sudo /home/pi/yamnet_venv/bin/python3 /home/pi/yamnet_uploader.py \
    --device-id rpi-001 \
    --api-token 116b9075617e5a0f5a2591ca967d93e68ba321063e5d03d1773a3fd53202d470 \
    --server-url https://eldersafe-fv6io3sc.manus.space \
    --model /home/pi/yamnet.tflite

# 测试录音（停止服务后执行）
sudo systemctl stop yamnet-monitor
arecord -D hw:1,0 -f S16_LE -r 16000 -c 2 -d 3 /tmp/test.wav
# 录音时说话，然后检查文件大小
ls -la /tmp/test.wav

# 检查 reSpeaker 是否被识别
arecord -l | grep -i respeaker
cat /proc/asound/cards

# 检查 USB 设备
lsusb | grep 2886
```

---

## 8. 脚本更新方法

```bash
# 1. 下载新脚本
wget -O /home/pi/yamnet_uploader.py "<新版本URL>"

# 2. 验证 MD5
md5sum /home/pi/yamnet_uploader.py

# 3. 重启服务
sudo systemctl restart yamnet-monitor

# 4. 查看日志确认正常（应看到 USB RESET → MIC READY → Listening）
tail -f /var/log/yamnet-monitor.log
```

---

## 9. 云端 Web 平台配置

| 项目 | 值 |
|------|-----|
| 域名 | `https://eldersafe-fv6io3sc.manus.space` |
| 项目名 | `elderly_safety_monitor` |
| 功能 | db, server, user |

---

## 10. 历史问题完整记录

| 日期 | 现象 | 根本原因 | 解决方案 | 验证状态 |
|------|------|----------|----------|---------|
| 2026-03-19 | YAMNet 持续识别为 Whale vocalization (96.9%) | sounddevice/PortAudio 返回 USB 帧计数器（锯齿波）而非真实音频 | 改用 ALSA `arecord` 直接录音，绕过 PortAudio | ✅ 已解决 |
| 2026-03-19 | 改用 arecord 后仍出现 Whale vocalization | reSpeaker 稀疏采样格式（每24帧1个有效样本）引入 DC 偏置，YAMNet 将 DC 偏置识别为低频声音 | 添加 DC 偏移去除（`audio - mean`）+ 归一化 | ✅ 已解决 |
| 2026-03-20 | 开机后脚本版本回退到旧版 | 之前只在手动测试中验证，未更新 systemd 使用的脚本文件 | 下载最新脚本到 `/home/pi/yamnet_uploader.py` 并重启服务 | ✅ 已解决 |
| 2026-03-22 | 重启后 Whale vocalization 误检再次出现 | USB 设备号变化（hw:2,0→hw:1,0），`find_alsa_device()` 检测正确，但 reSpeaker XVF3800 **USB 固件在重启后未激活**，输出固定底噪（RMS=0.0135/0.0140），YAMNet 将底噪分类为 Whale vocalization | 1) 提高 `RMS_TRIGGER` 至 0.02 过滤底噪；2) 加入黑名单过滤；3) 加入 USB 软重置；4) 加入就绪等待 | ✅ 已解决 |
| 2026-03-22 | 黑名单过滤后仍全部 Skipped，说话无反应 | **根本原因确认**：reSpeaker XVF3800 重启后 USB 固件未激活，物理重插 USB 后恢复正常。固件未激活时输出固定底噪，不响应任何外部声音 | 通过写入 `/sys/bus/usb/devices/*/authorized` 执行 USB 软重置，模拟物理重插，需 root 权限 | ✅ 已解决 |

---

> **核心原则：** 遇到问题先查本文档第6节故障排查表。如果是新问题，调试清楚后立即更新本文档，避免下次重复调试。
