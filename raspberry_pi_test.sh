#!/bin/bash

# ============================================================================
# 声音AI＋疾病与风险预测树莓派硬件测试脚本
# 这个脚本会检查所有硬件是否正常工作
# 使用方法：bash raspberry_pi_test.sh
# ============================================================================

set -e

echo "=========================================="
echo "声音AI＋疾病与风险预测硬件诊断工具"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 计数器
TESTS_PASSED=0
TESTS_FAILED=0

# 打印带颜色的消息
print_pass() {
    echo -e "${GREEN}[✓ 通过]${NC} $1"
    ((TESTS_PASSED++))
}

print_fail() {
    echo -e "${RED}[✗ 失败]${NC} $1"
    ((TESTS_FAILED++))
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# 测试1：检查系统信息
print_info "测试1: 检查系统信息"
echo "================================"

if uname -a | grep -q "arm"; then
    print_pass "树莓派系统检测成功"
else
    print_fail "未检测到树莓派系统"
fi

KERNEL=$(uname -r)
print_info "内核版本: $KERNEL"

CPU_TEMP=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null | awk '{print $1/1000}' || echo "N/A")
print_info "CPU温度: ${CPU_TEMP}°C"

MEMORY=$(free -h | grep Mem | awk '{print $2}')
print_info "内存大小: $MEMORY"

echo ""

# 测试2：检查网络连接
print_info "测试2: 检查网络连接"
echo "================================"

if ping -c 1 8.8.8.8 &> /dev/null; then
    print_pass "网络连接正常"
else
    print_fail "网络连接失败"
fi

if ip link show | grep -q "wlan0"; then
    WIFI_STATUS=$(ip link show wlan0 | grep "state UP" && echo "已连接" || echo "未连接")
    print_info "WiFi状态: $WIFI_STATUS"
fi

if ip link show | grep -q "eth0"; then
    ETH_STATUS=$(ip link show eth0 | grep "state UP" && echo "已连接" || echo "未连接")
    print_info "以太网状态: $ETH_STATUS"
fi

echo ""

# 测试3：检查音频设备
print_info "测试3: 检查音频设备"
echo "================================"

if command -v arecord &> /dev/null; then
    print_pass "ALSA工具已安装"
    
    # 列出所有音频设备
    print_info "检测到的音频设备:"
    arecord -l | grep "card" | while read line; do
        echo "  $line"
    done
    
    # 检查是否有麦克风设备
    if arecord -l | grep -qi "seeed\|respeaker\|microphone"; then
        print_pass "麦克风阵列已检测到"
    else
        print_warning "未检测到麦克风阵列，但其他音频设备可用"
    fi
else
    print_fail "ALSA工具未安装"
fi

echo ""

# 测试4：检查Python环境
print_info "测试4: 检查Python环境"
echo "================================"

if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    print_pass "Python已安装: $PYTHON_VERSION"
else
    print_fail "Python未安装"
fi

# 检查必要的Python库
REQUIRED_PACKAGES=("numpy" "requests" "librosa" "soundfile")

for package in "${REQUIRED_PACKAGES[@]}"; do
    if python3 -c "import $package" 2>/dev/null; then
        print_pass "Python库 '$package' 已安装"
    else
        print_warning "Python库 '$package' 未安装，请运行: pip3 install $package"
    fi
done

echo ""

# 测试5：检查TensorFlow Lite
print_info "测试5: 检查TensorFlow Lite"
echo "================================"

if python3 -c "import tensorflow as tf; print(tf.__version__)" 2>/dev/null; then
    TF_VERSION=$(python3 -c "import tensorflow as tf; print(tf.__version__)")
    print_pass "TensorFlow已安装: $TF_VERSION"
else
    print_warning "TensorFlow未安装，请运行: pip3 install tensorflow"
fi

echo ""

# 测试6：检查配置文件
print_info "测试6: 检查配置文件"
echo "================================"

CONFIG_FILE="$HOME/sound_ai_risk/config/config.yaml"
if [ -f "$CONFIG_FILE" ]; then
    print_pass "配置文件存在: $CONFIG_FILE"
    
    # 检查配置文件中的关键字段
    if grep -q "server:" "$CONFIG_FILE"; then
        print_pass "配置文件包含服务器配置"
    else
        print_warning "配置文件缺少服务器配置"
    fi
    
    if grep -q "audio:" "$CONFIG_FILE"; then
        print_pass "配置文件包含音频配置"
    else
        print_warning "配置文件缺少音频配置"
    fi
else
    print_warning "配置文件不存在: $CONFIG_FILE"
fi

echo ""

# 测试7：检查YAMNet模型
print_info "测试7: 检查YAMNet模型"
echo "================================"

MODEL_PATH="$HOME/sound_ai_risk/models/yamnet.tflite"
if [ -f "$MODEL_PATH" ]; then
    MODEL_SIZE=$(du -h "$MODEL_PATH" | awk '{print $1}')
    print_pass "YAMNet模型存在: $MODEL_SIZE"
else
    print_warning "YAMNet模型不存在: $MODEL_PATH"
    print_info "请下载模型文件到该位置"
fi

echo ""

# 测试8：检查日志目录
print_info "测试8: 检查日志目录"
echo "================================"

LOG_DIR="$HOME/sound_ai_risk/logs"
if [ -d "$LOG_DIR" ]; then
    print_pass "日志目录存在: $LOG_DIR"
    
    # 检查最近的日志文件
    if [ -f "$LOG_DIR/app.log" ]; then
        LOG_SIZE=$(du -h "$LOG_DIR/app.log" | awk '{print $1}')
        print_info "日志文件大小: $LOG_SIZE"
    fi
else
    print_warning "日志目录不存在，将在启动时创建"
fi

echo ""

# 测试9：检查systemd服务
print_info "测试9: 检查systemd服务"
echo "================================"

if systemctl list-unit-files | grep -q "sound_ai_risk.service"; then
    print_pass "systemd服务已注册"
    
    # 检查服务状态
    SERVICE_STATUS=$(systemctl is-active sound_ai_risk.service 2>/dev/null || echo "inactive")
    if [ "$SERVICE_STATUS" = "active" ]; then
        print_pass "服务正在运行"
    else
        print_info "服务未运行（这是正常的）"
    fi
else
    print_warning "systemd服务未注册"
fi

echo ""

# 测试10：音频录制测试（可选）
print_info "测试10: 音频录制测试（可选）"
echo "================================"

read -p "是否进行音频录制测试？(y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "开始录制5秒音频..."
    if arecord -D hw:0,0 -f S16_LE -r 16000 -c 2 -d 5 /tmp/test_audio.wav 2>/dev/null; then
        print_pass "音频录制成功"
        
        # 检查文件大小
        FILE_SIZE=$(du -h /tmp/test_audio.wav | awk '{print $1}')
        print_info "录制文件大小: $FILE_SIZE"
        
        # 尝试播放
        read -p "是否播放录制的音频？(y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if aplay /tmp/test_audio.wav 2>/dev/null; then
                print_pass "音频播放成功"
            else
                print_fail "音频播放失败"
            fi
        fi
        
        # 清理测试文件
        rm /tmp/test_audio.wav
    else
        print_fail "音频录制失败"
    fi
fi

echo ""

# 测试11：网络连接到服务器
print_info "测试11: 网络连接到服务器"
echo "================================"

read -p "请输入服务器地址 (例如: http://192.168.1.100:3000): " SERVER_URL

if [ -z "$SERVER_URL" ]; then
    print_warning "跳过服务器连接测试"
else
    if curl -s "$SERVER_URL" > /dev/null 2>&1; then
        print_pass "服务器连接成功: $SERVER_URL"
    else
        print_fail "无法连接到服务器: $SERVER_URL"
        print_info "请检查："
        print_info "  1. 服务器是否在线"
        print_info "  2. 网络连接是否正常"
        print_info "  3. 防火墙是否阻止了连接"
    fi
fi

echo ""

# 测试总结
echo "=========================================="
echo "测试总结"
echo "=========================================="
TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
echo -e "总测试数: $TOTAL_TESTS"
echo -e "${GREEN}通过: $TESTS_PASSED${NC}"
echo -e "${RED}失败: $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}所有测试通过！系统已准备好运行。${NC}"
else
    echo -e "${YELLOW}有些测试失败，请查看上面的详细信息。${NC}"
fi

echo ""
echo "建议的后续步骤："
echo "1. 修复任何失败的测试"
echo "2. 编辑配置文件: nano ~/sound_ai_risk/config/config.yaml"
echo "3. 启动服务: sudo systemctl start sound_ai_risk.service"
echo "4. 查看日志: sudo journalctl -u sound_ai_risk.service -f"
echo ""
