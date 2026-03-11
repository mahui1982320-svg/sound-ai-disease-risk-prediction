#!/bin/bash

# ============================================================================
# 小羊养老YAMNet一键自动安装脚本
# 这个脚本会自动完成YAMNet在树莓派上的所有安装步骤
# 使用方法：bash install_yamnet_auto.sh
# ============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# 进度条
show_progress() {
    local current=$1
    local total=$2
    local percent=$((current * 100 / total))
    local filled=$((percent / 5))
    local empty=$((20 - filled))
    
    printf "\r["
    printf "%${filled}s" | tr ' ' '='
    printf "%${empty}s" | tr ' ' '-'
    printf "] %d%%" $percent
}

# 检查是否为树莓派
check_raspberry_pi() {
    log_info "检查系统..."
    
    if ! grep -qi "raspberry" /proc/cpuinfo; then
        log_error "这不是树莓派系统！"
        exit 1
    fi
    
    log_success "检测到树莓派系统"
}

# 检查网络连接
check_network() {
    log_info "检查网络连接..."
    
    if ! ping -c 1 8.8.8.8 &> /dev/null; then
        log_error "网络连接失败！请检查网络设置。"
        exit 1
    fi
    
    log_success "网络连接正常"
}

# 第1步：更新系统
step_update_system() {
    log_info "第1步：更新系统（这可能需要10-15分钟）..."
    
    sudo apt-get update
    sudo apt-get upgrade -y
    sudo apt-get autoremove -y
    
    log_success "系统更新完成"
}

# 第2步：安装系统依赖
step_install_dependencies() {
    log_info "第2步：安装系统依赖..."
    
    local packages=(
        "build-essential"
        "python3-dev"
        "libatlas-base-dev"
        "libjasper-dev"
        "libtiff5"
        "libjasper1"
        "libharfbuzz0b"
        "libwebp6"
        "python3-pip"
        "python3-venv"
        "git"
        "alsa-utils"
        "portaudio19-dev"
        "libportaudio2"
        "curl"
        "wget"
        "nano"
    )
    
    local total=${#packages[@]}
    local current=0
    
    for package in "${packages[@]}"; do
        ((current++))
        show_progress $current $total
        sudo apt-get install -y "$package" &> /dev/null
    done
    
    echo ""
    log_success "系统依赖安装完成"
}

# 第3步：安装ReSpeaker驱动
step_install_respeaker() {
    log_info "第3步：安装ReSpeaker驱动..."
    
    read -p "您是否使用ReSpeaker麦克风阵列？(y/n) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd /tmp
        git clone https://github.com/respeaker/seeed-voicecard.git
        cd seeed-voicecard
        sudo bash install.sh
        
        log_success "ReSpeaker驱动安装完成，需要重启树莓派"
        
        read -p "现在重启树莓派？(y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            log_info "树莓派重启中..."
            sudo reboot
        else
            log_warning "请手动重启树莓派后继续安装"
            exit 0
        fi
    else
        log_info "跳过ReSpeaker驱动安装"
    fi
}

# 第4步：创建工作目录
step_create_directories() {
    log_info "第4步：创建工作目录..."
    
    mkdir -p ~/xiaoyanglaoyao/models
    mkdir -p ~/xiaoyanglaoyao/config
    mkdir -p ~/xiaoyanglaoyao/logs
    mkdir -p ~/xiaoyanglaoyao/recordings
    
    log_success "工作目录创建完成"
}

# 第5步：创建Python虚拟环境
step_create_venv() {
    log_info "第5步：创建Python虚拟环境..."
    
    python3 -m venv ~/xiaoyanglaoyao/venv
    source ~/xiaoyanglaoyao/venv/bin/activate
    pip install --upgrade pip setuptools wheel
    
    log_success "Python虚拟环境创建完成"
}

# 第6步：安装Python依赖
step_install_python_packages() {
    log_info "第6步：安装Python依赖（这可能需要15-20分钟）..."
    
    source ~/xiaoyanglaoyao/venv/bin/activate
    
    local packages=(
        "numpy"
        "tflite-runtime"
        "librosa"
        "soundfile"
        "sounddevice"
        "pyaudio"
        "requests"
        "pyyaml"
        "python-dateutil"
    )
    
    local total=${#packages[@]}
    local current=0
    
    for package in "${packages[@]}"; do
        ((current++))
        show_progress $current $total
        pip install "$package" &> /dev/null
    done
    
    echo ""
    log_success "Python依赖安装完成"
}

# 第7步：下载YAMNet模型
step_download_yamnet_model() {
    log_info "第7步：下载YAMNet模型（约50MB）..."
    
    cd ~/xiaoyanglaoyao/models
    
    log_info "下载YAMNet TFLite模型..."
    wget -q https://tfhub.dev/google/lite-model/yamnet/classification/tflite/1?lite-format=tflite -O yamnet.tflite
    
    log_info "下载YAMNet标签文件..."
    wget -q https://raw.githubusercontent.com/tensorflow/models/master/research/audio_recognition/yamnet/yamnet_labels.txt -O yamnet_labels.txt
    
    # 验证文件
    if [ -f "yamnet.tflite" ] && [ -f "yamnet_labels.txt" ]; then
        log_success "YAMNet模型下载完成"
    else
        log_error "YAMNet模型下载失败"
        exit 1
    fi
}

# 第8步：创建配置文件
step_create_config() {
    log_info "第8步：创建配置文件..."
    
    cat > ~/xiaoyanglaoyao/config/config.yaml << 'EOF'
# 小羊养老YAMNet配置文件

# 服务器配置
server:
  url: "http://192.168.1.100:3000/api/trpc"
  timeout: 10
  max_retries: 3

# 老人信息
elderly:
  id: 30001
  name: "李奶奶"
  room: "101"

# 音频配置
audio:
  sample_rate: 16000
  duration: 10
  channels: 2
  device: 0

# YAMNet配置
yamnet:
  model_path: "/home/pi/xiaoyanglaoyao/models/yamnet.tflite"
  labels_path: "/home/pi/xiaoyanglaoyao/models/yamnet_labels.txt"
  confidence_threshold: 0.7
  monitored_events:
    - "Thud"
    - "Crash"
    - "Scream"
    - "Shouting"
    - "Crying"
    - "Cough"
    - "Sneeze"
    - "Whimper"
    - "Moan"
    - "Snoring"

# 日志配置
logging:
  level: "INFO"
  log_file: "/home/pi/xiaoyanglaoyao/logs/app.log"
  max_size: 50
  backup_count: 5

# 本地警报配置
alert:
  enable_beep: true
  beep_pin: 17
  beep_frequency: 1000
  beep_duration: 2
EOF
    
    log_success "配置文件创建完成"
    log_warning "请编辑配置文件并设置正确的服务器地址和老人信息"
    log_info "编辑配置：nano ~/xiaoyanglaoyao/config/config.yaml"
}

# 第9步：设置自动启动
step_setup_autostart() {
    log_info "第9步：设置自动启动..."
    
    sudo tee /etc/systemd/system/xiaoyanglaoyao.service > /dev/null << 'EOF'
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
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable xiaoyanglaoyao.service
    
    log_success "自动启动配置完成"
}

# 主函数
main() {
    echo "=========================================="
    echo "小羊养老YAMNet一键安装脚本"
    echo "=========================================="
    echo ""
    
    # 检查前置条件
    check_raspberry_pi
    check_network
    
    echo ""
    log_warning "这个脚本会进行以下操作："
    echo "1. 更新系统（需要10-15分钟）"
    echo "2. 安装系统依赖"
    echo "3. 安装ReSpeaker驱动（如果使用）"
    echo "4. 创建工作目录"
    echo "5. 创建Python虚拟环境"
    echo "6. 安装Python依赖（需要15-20分钟）"
    echo "7. 下载YAMNet模型（约50MB）"
    echo "8. 创建配置文件"
    echo "9. 设置自动启动"
    echo ""
    echo "总耗时：约1-2小时"
    echo ""
    
    read -p "是否继续？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "安装已取消"
        exit 0
    fi
    
    # 执行安装步骤
    step_update_system
    echo ""
    
    step_install_dependencies
    echo ""
    
    step_install_respeaker
    echo ""
    
    step_create_directories
    echo ""
    
    step_create_venv
    echo ""
    
    step_install_python_packages
    echo ""
    
    step_download_yamnet_model
    echo ""
    
    step_create_config
    echo ""
    
    step_setup_autostart
    echo ""
    
    # 完成
    echo "=========================================="
    echo "✓ 安装完成！"
    echo "=========================================="
    echo ""
    echo "后续步骤："
    echo "1. 编辑配置文件："
    echo "   nano ~/xiaoyanglaoyao/config/config.yaml"
    echo ""
    echo "2. 复制YAMNet程序文件："
    echo "   cp raspberry_pi_yamnet.py ~/xiaoyanglaoyao/"
    echo ""
    echo "3. 测试YAMNet程序："
    echo "   source ~/xiaoyanglaoyao/venv/bin/activate"
    echo "   python3 ~/xiaoyanglaoyao/raspberry_pi_yamnet.py"
    echo ""
    echo "4. 启动服务："
    echo "   sudo systemctl start xiaoyanglaoyao.service"
    echo ""
    echo "5. 查看日志："
    echo "   sudo journalctl -u xiaoyanglaoyao.service -f"
    echo ""
}

# 运行主函数
main
