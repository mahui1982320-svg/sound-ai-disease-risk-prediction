# 🎯 树莓派YAMNet安装完整指南

本指南为非技术人员提供了在树莓派上安装和配置YAMNet的详细步骤。YAMNet是Google开源的音频事件分类模型，能够识别521种不同的声音事件，包括摔倒、尖叫、咳嗽等危险信号。

---

## 📋 前置条件

在开始安装之前，请确保您已经完成以下准备工作：

### 硬件准备
- **树莓派 4B**（推荐4GB或8GB内存）
- **ReSpeaker 2-Mics Pi HAT** 或 **ReSpeaker 4-Mic Array** 麦克风阵列
- **32GB microSD卡**（推荐Class 10）
- **5V 3A电源适配器**
- **网线或WiFi连接**

### 系统准备
- 树莓派已安装 **Raspberry Pi OS Lite** 或 **Raspberry Pi OS Desktop**（推荐Bullseye版本或更新）
- 树莓派已连接到网络（有网线或WiFi）
- 您可以通过SSH或直接连接显示器访问树莓派

---

## 🚀 安装步骤

### 第1步：更新系统（5分钟）

首先，更新树莓派的系统软件包到最新版本。这确保您有最新的安全补丁和驱动程序。

```bash
# 连接到树莓派（如果使用SSH）
ssh pi@192.168.1.100
# 输入默认密码：raspberry

# 更新系统包列表
sudo apt-get update

# 升级已安装的包
sudo apt-get upgrade -y

# 清理不需要的包
sudo apt-get autoremove -y
```

**预期输出**：系统会下载并安装更新，这可能需要5-10分钟。

**常见问题**：
- 如果提示"连接超时"，检查网络连接
- 如果提示"权限不足"，确保使用了 `sudo` 命令

---

### 第2步：安装必要的系统依赖（10分钟）

YAMNet需要一些系统级的库来运行。这一步安装这些依赖。

```bash
# 安装编译工具（用于编译某些Python包）
sudo apt-get install -y build-essential python3-dev

# 安装音频处理库
sudo apt-get install -y libatlas-base-dev libjasper-dev libtiff5 libjasper1 libharfbuzz0b libwebp6 libtiff5

# 安装Python包管理工具
sudo apt-get install -y python3-pip python3-venv

# 安装Git（用于下载代码）
sudo apt-get install -y git

# 安装音频工具
sudo apt-get install -y alsa-utils portaudio19-dev libportaudio2

# 安装系统工具
sudo apt-get install -y curl wget nano
```

**预期输出**：系统会显示"正在处理..."，然后完成安装。

**预计时间**：10-15分钟（取决于网络速度）

---

### 第3步：配置麦克风阵列（5分钟）

如果您使用ReSpeaker麦克风阵列，需要安装相应的驱动程序。

#### 3.1 安装ReSpeaker驱动（如果使用ReSpeaker）

```bash
# 克隆ReSpeaker驱动仓库
git clone https://github.com/respeaker/seeed-voicecard.git
cd seeed-voicecard

# 运行安装脚本
sudo bash install.sh

# 重启树莓派以加载驱动
sudo reboot
```

**重启后重新连接到树莓派**：
```bash
ssh pi@192.168.1.100
```

#### 3.2 验证麦克风是否正常工作

```bash
# 列出所有音频设备
arecord -l

# 输出示例：
# **** List of CAPTURE Hardware Devices ****
# card 1: seeed2micvoicec [seeed-2mic-voicecard], device 0: ...
```

**如果看到 "seeed" 相关的设备**，说明驱动安装成功！

---

### 第4步：创建工作目录和Python虚拟环境（3分钟）

为了隔离YAMNet的依赖，我们创建一个Python虚拟环境。

```bash
# 创建工作目录
mkdir -p ~/xiaoyanglaoyao/models
mkdir -p ~/xiaoyanglaoyao/config
mkdir -p ~/xiaoyanglaoyao/logs
mkdir -p ~/xiaoyanglaoyao/recordings

# 创建Python虚拟环境
python3 -m venv ~/xiaoyanglaoyao/venv

# 激活虚拟环境
source ~/xiaoyanglaoyao/venv/bin/activate

# 升级pip
pip install --upgrade pip setuptools wheel
```

**预期输出**：命令行前缀会变成 `(venv) pi@raspberrypi:~$`

---

### 第5步：安装Python依赖包（15分钟）

现在安装YAMNet运行所需的所有Python库。

```bash
# 确保虚拟环境已激活
source ~/xiaoyanglaoyao/venv/bin/activate

# 安装NumPy（数值计算库）
pip install numpy

# 安装TensorFlow Lite（轻量级机器学习框架）
pip install tflite-runtime

# 安装音频处理库
pip install librosa soundfile sounddevice pyaudio

# 安装网络请求库
pip install requests

# 安装配置文件库
pip install pyyaml

# 安装日志库
pip install python-dateutil
```

**预期输出**：每个包会显示"Successfully installed..."

**预计时间**：15-20分钟（取决于网络速度和树莓派性能）

**常见问题**：
- 如果提示"No module named 'pip'"，运行 `sudo apt-get install python3-pip`
- 如果安装很慢，可以使用阿里云镜像：`pip install -i https://mirrors.aliyun.com/pypi/simple/ numpy`

---

### 第6步：下载YAMNet模型（5分钟）

YAMNet模型文件大约50MB，需要从Google下载。

```bash
# 确保虚拟环境已激活
source ~/xiaoyanglaoyao/venv/bin/activate

# 进入模型目录
cd ~/xiaoyanglaoyao/models

# 下载YAMNet TFLite模型
wget https://tfhub.dev/google/lite-model/yamnet/classification/tflite/1?lite-format=tflite -O yamnet.tflite

# 下载YAMNet类标签（521个音频事件的名称）
wget https://raw.githubusercontent.com/tensorflow/models/master/research/audio_recognition/yamnet/yamnet_labels.txt -O yamnet_labels.txt

# 验证文件是否下载成功
ls -lh
```

**预期输出**：
```
-rw-r--r-- 1 pi pi 50M ... yamnet.tflite
-rw-r--r-- 1 pi pi 12K ... yamnet_labels.txt
```

**如果下载失败**：可以尝试手动下载，然后通过SCP上传到树莓派：
```bash
# 在您的电脑上运行
scp yamnet.tflite pi@192.168.1.100:~/xiaoyanglaoyao/models/
scp yamnet_labels.txt pi@192.168.1.100:~/xiaoyanglaoyao/models/
```

---

### 第7步：创建配置文件（3分钟）

配置文件定义了YAMNet程序的运行参数。

```bash
# 创建配置文件
nano ~/xiaoyanglaoyao/config/config.yaml
```

**将以下内容复制到文件中**：

```yaml
# 小羊养老YAMNet配置文件

# 服务器配置
server:
  # 云端服务器地址（需要替换为您的实际服务器地址）
  url: "http://192.168.1.100:3000/api/trpc"
  # 连接超时时间（秒）
  timeout: 10
  # 重试次数
  max_retries: 3

# 老人信息
elderly:
  # 老人ID（需要替换为实际的老人ID）
  id: 30001
  # 老人名字
  name: "李奶奶"
  # 房间号
  room: "101"

# 音频配置
audio:
  # 采样率（Hz）- YAMNet要求16000Hz
  sample_rate: 16000
  # 每次采集的时长（秒）
  duration: 10
  # 音频通道数（单声道=1，立体声=2）
  channels: 2
  # 使用的音频设备（0=默认设备，或指定设备号）
  device: 0

# YAMNet配置
yamnet:
  # 模型文件路径
  model_path: "/home/pi/xiaoyanglaoyao/models/yamnet.tflite"
  # 标签文件路径
  labels_path: "/home/pi/xiaoyanglaoyao/models/yamnet_labels.txt"
  # 置信度阈值（0-1，只有置信度高于此值的事件才会触发警报）
  confidence_threshold: 0.7
  # 需要监听的事件类型
  monitored_events:
    - "Thud"           # 撞击声（可能是摔倒）
    - "Crash"          # 碎裂声
    - "Scream"         # 尖叫
    - "Shouting"       # 喊叫
    - "Crying"         # 哭声
    - "Cough"          # 咳嗽
    - "Sneeze"         # 打喷嚏
    - "Whimper"        # 呜咽
    - "Moan"           # 呻吟
    - "Snoring"        # 打鼾

# 日志配置
logging:
  # 日志级别：DEBUG, INFO, WARNING, ERROR
  level: "INFO"
  # 日志文件路径
  log_file: "/home/pi/xiaoyanglaoyao/logs/app.log"
  # 最大日志文件大小（MB）
  max_size: 50
  # 保留的日志文件数量
  backup_count: 5

# 本地警报配置
alert:
  # 是否启用本地蜂鸣器警报
  enable_beep: true
  # 蜂鸣器GPIO引脚（如果有）
  beep_pin: 17
  # 蜂鸣频率（Hz）
  beep_frequency: 1000
  # 蜂鸣持续时间（秒）
  beep_duration: 2
```

**保存文件**：按 `Ctrl+O`，然后按 `Enter`，最后按 `Ctrl+X` 退出

---

### 第8步：复制YAMNet程序文件（2分钟）

将我们之前写的YAMNet程序复制到树莓派。

```bash
# 从您的电脑复制程序文件到树莓派
# 在您的电脑上运行
scp raspberry_pi_yamnet.py pi@192.168.1.100:~/xiaoyanglaoyao/

# 或者，如果已经在树莓派上，直接复制
cp /path/to/raspberry_pi_yamnet.py ~/xiaoyanglaoyao/
```

**验证文件**：
```bash
ls -lh ~/xiaoyanglaoyao/raspberry_pi_yamnet.py
```

---

### 第9步：测试YAMNet安装（5分钟）

现在测试YAMNet是否能正常工作。

```bash
# 激活虚拟环境
source ~/xiaoyanglaoyao/venv/bin/activate

# 进入工作目录
cd ~/xiaoyanglaoyao

# 运行YAMNet程序（会录制10秒音频并分析）
python3 raspberry_pi_yamnet.py
```

**预期输出**：
```
[INFO] YAMNet程序启动
[INFO] 加载模型: /home/pi/xiaoyanglaoyao/models/yamnet.tflite
[INFO] 加载标签: /home/pi/xiaoyanglaoyao/models/yamnet_labels.txt
[INFO] 开始监听音频...
[INFO] 正在录制10秒音频...
[INFO] 音频录制完成
[INFO] 正在分析音频...
[INFO] 检测到事件: Cough (咳嗽), 置信度: 0.85
[INFO] 检测到事件: Moan (呻吟), 置信度: 0.72
[INFO] 上传结果到服务器...
[INFO] 上传成功
```

**如果出现错误**：
- 错误："No module named 'tflite_runtime'"→ 重新运行 `pip install tflite-runtime`
- 错误："Cannot connect to server"→ 检查服务器地址是否正确
- 错误："Cannot record audio"→ 检查麦克风是否正确连接

---

### 第10步：设置自动启动（3分钟）

配置树莓派在启动时自动运行YAMNet程序。

```bash
# 创建systemd服务文件
sudo nano /etc/systemd/system/xiaoyanglaoyao.service
```

**将以下内容复制到文件中**：

```ini
[Unit]
Description=小羊养老YAMNet监控服务
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/xiaoyanglaoyao
ExecStart=/home/pi/xiaoyanglaoyao/venv/bin/python3 /home/pi/xiaoyanglaoyao/raspberry_pi_yamnet.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**保存文件**：按 `Ctrl+O`，然后按 `Enter`，最后按 `Ctrl+X` 退出

**启用服务**：
```bash
# 重新加载systemd配置
sudo systemctl daemon-reload

# 启用服务（开机自启）
sudo systemctl enable xiaoyanglaoyao.service

# 启动服务
sudo systemctl start xiaoyanglaoyao.service

# 查看服务状态
sudo systemctl status xiaoyanglaoyao.service

# 查看实时日志
sudo journalctl -u xiaoyanglaoyao.service -f
```

**预期输出**：
```
● xiaoyanglaoyao.service - 小羊养老YAMNet监控服务
   Loaded: loaded (/etc/systemd/system/xiaoyanglaoyao.service; enabled; vendor preset: enabled)
   Active: active (running) since Mon 2024-03-09 10:15:30 UTC; 5s ago
   Main PID: 1234 (python3)
   ...
```

---

## ✅ 验证安装成功

### 检查清单

- [ ] 系统已更新到最新版本
- [ ] 麦克风驱动已安装并识别
- [ ] Python虚拟环境已创建
- [ ] 所有Python依赖已安装
- [ ] YAMNet模型文件已下载
- [ ] 配置文件已创建并配置
- [ ] YAMNet程序可以成功运行
- [ ] 服务已启用并自动启动

### 快速测试

```bash
# 检查服务是否运行
sudo systemctl status xiaoyanglaoyao.service

# 检查日志是否有错误
sudo journalctl -u xiaoyanglaoyao.service -n 50

# 检查是否有音频设备
arecord -l

# 检查网络连接
ping 8.8.8.8
```

---

## 🔧 常见问题解决

### 问题1：麦克风无法识别

**症状**：`arecord -l` 不显示麦克风设备

**解决方案**：
```bash
# 检查USB设备是否识别
lsusb

# 重新安装驱动
cd ~/seeed-voicecard
sudo bash install.sh
sudo reboot
```

### 问题2：Python包安装失败

**症状**：`pip install` 显示"No module found"或"Connection timeout"

**解决方案**：
```bash
# 使用阿里云镜像加速
pip install -i https://mirrors.aliyun.com/pypi/simple/ numpy

# 或使用清华大学镜像
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple numpy
```

### 问题3：YAMNet程序无法连接到服务器

**症状**：日志显示"Cannot connect to server"

**解决方案**：
```bash
# 检查网络连接
ping 192.168.1.100

# 检查服务器是否在线
curl http://192.168.1.100:3000

# 检查配置文件中的服务器地址
nano ~/xiaoyanglaoyao/config/config.yaml
```

### 问题4：内存不足

**症状**：程序运行一段时间后停止，日志显示"Memory error"

**解决方案**：
```bash
# 检查内存使用情况
free -h

# 关闭不必要的服务
sudo systemctl stop cups
sudo systemctl stop bluetooth

# 增加交换空间
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile  # 修改CONF_SWAPSIZE=2048
sudo dphys-swapfile swapon
```

### 问题5：CPU温度过高

**症状**：树莓派变热，程序运行缓慢

**解决方案**：
```bash
# 检查CPU温度
cat /sys/class/thermal/thermal_zone0/temp

# 增加散热：安装散热片或风扇
# 降低CPU频率
sudo nano /boot/config.txt
# 添加以下行：
# arm_freq=1400
# gpu_freq=400

# 重启
sudo reboot
```

---

## 📊 性能优化建议

### 1. 减少采集时长

如果系统响应缓慢，可以减少每次采集的音频时长：

```yaml
# 在 config.yaml 中修改
audio:
  duration: 5  # 改为5秒而不是10秒
```

### 2. 增加置信度阈值

减少误报，只在置信度很高时才触发警报：

```yaml
yamnet:
  confidence_threshold: 0.8  # 改为0.8而不是0.7
```

### 3. 只监听必要的事件

减少需要监听的事件类型，加快处理速度：

```yaml
yamnet:
  monitored_events:
    - "Thud"           # 只监听最重要的事件
    - "Scream"
    - "Moan"
```

---

## 🚀 下一步

安装完成后，您可以：

1. **配置云端系统** - 确保树莓派能连接到您的云端服务器
2. **进行实际测试** - 在老人家里运行一周，收集真实数据
3. **调整参数** - 根据实际运行情况调整置信度阈值和监听事件
4. **添加告警** - 配置蜂鸣器或LED灯作为本地警报
5. **监控日志** - 定期检查日志文件，确保系统正常运行

---

## 📞 获取帮助

如果遇到问题，请：

1. 查看日志文件：`tail -f ~/xiaoyanglaoyao/logs/app.log`
2. 运行诊断脚本：`bash ~/raspberry_pi_test.sh`
3. 检查配置文件：`cat ~/xiaoyanglaoyao/config/config.yaml`
4. 查看系统信息：`uname -a && free -h && df -h`

---

**祝您安装顺利！如有问题，请参考上面的常见问题解决部分。**
