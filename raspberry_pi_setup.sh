#!/bin/bash

# ============================================================================
# 声音AI＋疾病与风险预测树莓派自动配置脚本
# 这个脚本会自动安装所有必要的软件和驱动
# 使用方法：bash raspberry_pi_setup.sh
# ============================================================================

set -e  # 如果有错误就停止执行

echo "=========================================="
echo "声音AI＋疾病与风险预测声音监控系统 - 树莓派自动配置"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[i]${NC} $1"
}

# 第1步：更新系统
print_info "第1步：更新系统软件包..."
sudo apt update
sudo apt upgrade -y
print_status "系统更新完成"
echo ""

# 第2步：安装基础工具
print_info "第2步：安装基础工具..."
sudo apt install -y \
    build-essential \
    python3 \
    python3-pip \
    python3-dev \
    git \
    curl \
    wget \
    nano \
    vim \
    htop \
    alsa-utils \
    pulseaudio \
    pulseaudio-utils \
    libatlas-base-dev \
    libjasper-dev \
    libtiff5 \
    libjasper1 \
    libharfbuzz0b \
    libwebp6 \
    libtiff5

print_status "基础工具安装完成"
echo ""

# 第3步：安装Python库
print_info "第3步：安装Python库..."
pip3 install --upgrade pip setuptools wheel
pip3 install numpy scipy soundfile librosa
pip3 install tensorflow-lite
pip3 install requests
pip3 install pyyaml

print_status "Python库安装完成"
echo ""

# 第4步：安装麦克风阵列驱动
print_info "第4步：安装麦克风阵列驱动..."
cd ~
if [ ! -d "seeed-voicecard" ]; then
    git clone https://github.com/respeaker/seeed-voicecard.git
fi
cd seeed-voicecard
sudo bash install.sh

print_status "麦克风阵列驱动安装完成"
echo ""

# 第5步：创建工作目录
print_info "第5步：创建工作目录..."
mkdir -p ~/sound_ai_risk
mkdir -p ~/sound_ai_risk/logs
mkdir -p ~/sound_ai_risk/models
mkdir -p ~/sound_ai_risk/config

print_status "工作目录创建完成"
echo ""

# 第6步：配置音频
print_info "第6步：配置音频系统..."
# 设置默认音频设备
sudo tee /etc/asound.conf > /dev/null <<EOF
pcm.!default {
    type asym
    playback.pcm "speaker"
    capture.pcm "mic"
}

pcm.speaker {
    type plug
    slave.pcm "hw:0,0"
}

pcm.mic {
    type plug
    slave.pcm "hw:0,0"
}

ctl.!default {
    type hw
    card 0
}
EOF

print_status "音频系统配置完成"
echo ""

# 第7步：创建配置文件
print_info "第7步：创建配置文件..."
cat > ~/sound_ai_risk/config/config.yaml <<EOF
# 声音AI＋疾病与风险预测声音监控系统配置文件

# 服务器配置
server:
  url: "http://your-server-address:3000"  # 修改为您的服务器地址
  api_key: "your-api-key"  # 修改为您的API密钥

# 音频配置
audio:
  sample_rate: 16000  # 采样率
  channels: 2  # 通道数
  chunk_size: 4096  # 块大小
  device_index: 0  # 设备索引

# YAMNet模型配置
yamnet:
  model_path: "/home/pi/sound_ai_risk/models/yamnet.tflite"
  confidence_threshold: 0.5  # 置信度阈值
  event_types:
    - "fall"  # 跌倒
    - "scream"  # 尖叫
    - "cough"  # 咳嗽
    - "moan"  # 呻吟

# 日志配置
logging:
  level: "INFO"  # DEBUG, INFO, WARNING, ERROR
  file: "/home/pi/sound_ai_risk/logs/app.log"
  max_size: 10485760  # 10MB
  backup_count: 5

# 系统配置
system:
  device_id: "rpi-$(hostname)"
  location: "Room 101"  # 修改为您的位置
  upload_interval: 5  # 上传间隔（秒）
EOF

print_status "配置文件创建完成"
echo ""

# 第8步：测试麦克风
print_info "第8步：测试麦克风..."
print_info "运行以下命令测试麦克风："
echo "  arecord -l  # 列出所有音频设备"
echo "  arecord -D hw:0,0 -f S16_LE -r 16000 -c 2 -d 5 test.wav  # 录制5秒"
echo "  aplay test.wav  # 播放录制的文件"
echo ""

# 第9步：创建启动脚本
print_info "第9步：创建启动脚本..."
cat > ~/sound_ai_risk/start.sh <<'EOF'
#!/bin/bash

# 声音AI＋疾病与风险预测系统启动脚本

echo "启动声音AI＋疾病与风险预测声音监控系统..."

# 检查配置文件
if [ ! -f "config/config.yaml" ]; then
    echo "错误：找不到配置文件 config/config.yaml"
    exit 1
fi

# 启动Python应用
python3 main.py

EOF

chmod +x ~/sound_ai_risk/start.sh
print_status "启动脚本创建完成"
echo ""

# 第10步：创建systemd服务
print_info "第10步：创建systemd服务..."
sudo tee /etc/systemd/system/sound_ai_risk.service > /dev/null <<EOF
[Unit]
Description=Sound AI Risk Prediction Audio Monitoring Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/sound_ai_risk
ExecStart=/usr/bin/python3 /home/pi/sound_ai_risk/main.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
print_status "systemd服务创建完成"
echo ""

# 第11步：重启系统
print_info "第11步：系统配置完成！"
echo ""
echo "=========================================="
echo "配置完成！"
echo "=========================================="
echo ""
echo "后续步骤："
echo "1. 编辑配置文件："
echo "   nano ~/sound_ai_risk/config/config.yaml"
echo ""
echo "2. 修改以下内容："
echo "   - server.url: 改为您的服务器地址"
echo "   - server.api_key: 改为您的API密钥"
echo "   - system.location: 改为您的位置"
echo ""
echo "3. 测试麦克风："
echo "   arecord -l"
echo ""
echo "4. 启动服务："
echo "   sudo systemctl start sound_ai_risk.service"
echo ""
echo "5. 查看服务状态："
echo "   sudo systemctl status sound_ai_risk.service"
echo ""
echo "6. 查看日志："
echo "   sudo journalctl -u sound_ai_risk.service -f"
echo ""
echo "需要重启系统以应用所有更改（可选）："
echo "   sudo reboot"
echo ""
