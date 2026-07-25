#!/bin/bash

# ============================================================================
# 声音AI＋疾病与风险预测YAMNet安装验证脚本
# 这个脚本会检查YAMNet安装是否成功，所有组件是否正常工作
# 使用方法：bash verify_yamnet_installation.sh
# ============================================================================

set -e

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

print_section() {
    echo ""
    echo "=========================================="
    echo "$1"
    echo "=========================================="
}

# 测试1：检查工作目录
test_directories() {
    print_section "测试1：检查工作目录"
    
    local dirs=(
        "$HOME/sound_ai_risk"
        "$HOME/sound_ai_risk/models"
        "$HOME/sound_ai_risk/config"
        "$HOME/sound_ai_risk/logs"
        "$HOME/sound_ai_risk/recordings"
    )
    
    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            print_pass "目录存在: $dir"
        else
            print_fail "目录不存在: $dir"
        fi
    done
}

# 测试2：检查YAMNet模型文件
test_yamnet_models() {
    print_section "测试2：检查YAMNet模型文件"
    
    local model_file="$HOME/sound_ai_risk/models/yamnet.tflite"
    local labels_file="$HOME/sound_ai_risk/models/yamnet_labels.txt"
    
    if [ -f "$model_file" ]; then
        local size=$(du -h "$model_file" | awk '{print $1}')
        print_pass "YAMNet模型存在: $size"
    else
        print_fail "YAMNet模型不存在: $model_file"
    fi
    
    if [ -f "$labels_file" ]; then
        local lines=$(wc -l < "$labels_file")
        print_pass "标签文件存在: $lines 个标签"
    else
        print_fail "标签文件不存在: $labels_file"
    fi
}

# 测试3：检查配置文件
test_config_file() {
    print_section "测试3：检查配置文件"
    
    local config_file="$HOME/sound_ai_risk/config/config.yaml"
    
    if [ -f "$config_file" ]; then
        print_pass "配置文件存在"
        
        # 检查配置文件中的关键字段
        if grep -q "server:" "$config_file"; then
            print_pass "配置文件包含服务器配置"
        else
            print_warning "配置文件缺少服务器配置"
        fi
        
        if grep -q "yamnet:" "$config_file"; then
            print_pass "配置文件包含YAMNet配置"
        else
            print_warning "配置文件缺少YAMNet配置"
        fi
        
        if grep -q "audio:" "$config_file"; then
            print_pass "配置文件包含音频配置"
        else
            print_warning "配置文件缺少音频配置"
        fi
    else
        print_fail "配置文件不存在: $config_file"
    fi
}

# 测试4：检查Python虚拟环境
test_python_venv() {
    print_section "测试4：检查Python虚拟环境"
    
    local venv_dir="$HOME/sound_ai_risk/venv"
    
    if [ -d "$venv_dir" ]; then
        print_pass "虚拟环境目录存在"
        
        if [ -f "$venv_dir/bin/python3" ]; then
            print_pass "Python3可执行文件存在"
            
            local python_version=$("$venv_dir/bin/python3" --version)
            print_info "Python版本: $python_version"
        else
            print_fail "Python3可执行文件不存在"
        fi
    else
        print_fail "虚拟环境目录不存在: $venv_dir"
    fi
}

# 测试5：检查Python依赖包
test_python_packages() {
    print_section "测试5：检查Python依赖包"
    
    local venv_python="$HOME/sound_ai_risk/venv/bin/python3"
    
    local packages=(
        "numpy"
        "tflite_runtime"
        "librosa"
        "soundfile"
        "sounddevice"
        "requests"
        "yaml"
    )
    
    for package in "${packages[@]}"; do
        if "$venv_python" -c "import $package" 2>/dev/null; then
            print_pass "Python库已安装: $package"
        else
            print_fail "Python库未安装: $package"
        fi
    done
}

# 测试6：检查音频设备
test_audio_devices() {
    print_section "测试6：检查音频设备"
    
    if command -v arecord &> /dev/null; then
        print_pass "ALSA工具已安装"
        
        # 列出所有音频设备
        print_info "检测到的音频设备:"
        arecord -l 2>/dev/null | grep "card" | while read line; do
            echo "  $line"
        done
        
        # 检查是否有麦克风设备
        if arecord -l 2>/dev/null | grep -qi "seeed\|respeaker\|microphone"; then
            print_pass "麦克风阵列已检测到"
        else
            print_warning "未检测到麦克风阵列，但其他音频设备可用"
        fi
    else
        print_fail "ALSA工具未安装"
    fi
}

# 测试7：检查网络连接
test_network() {
    print_section "测试7：检查网络连接"
    
    if ping -c 1 8.8.8.8 &> /dev/null; then
        print_pass "互联网连接正常"
    else
        print_fail "互联网连接失败"
    fi
    
    # 检查配置中的服务器地址
    local config_file="$HOME/sound_ai_risk/config/config.yaml"
    if [ -f "$config_file" ]; then
        local server_url=$(grep "url:" "$config_file" | awk -F'"' '{print $2}' | head -1)
        if [ -n "$server_url" ]; then
            print_info "配置的服务器地址: $server_url"
            
            # 尝试连接到服务器
            if curl -s "$server_url" > /dev/null 2>&1; then
                print_pass "服务器连接成功"
            else
                print_warning "无法连接到服务器（可能服务器离线或地址错误）"
            fi
        fi
    fi
}

# 测试8：检查systemd服务
test_systemd_service() {
    print_section "测试8：检查systemd服务"
    
    if systemctl list-unit-files 2>/dev/null | grep -q "sound_ai_risk.service"; then
        print_pass "systemd服务已注册"
        
        # 检查服务状态
        local service_status=$(systemctl is-active sound_ai_risk.service 2>/dev/null || echo "inactive")
        if [ "$service_status" = "active" ]; then
            print_pass "服务正在运行"
        else
            print_info "服务未运行（这是正常的，可以手动启动）"
        fi
    else
        print_warning "systemd服务未注册（需要运行自动安装脚本）"
    fi
}

# 测试9：检查YAMNet程序文件
test_yamnet_program() {
    print_section "测试9：检查YAMNet程序文件"
    
    local program_file="$HOME/sound_ai_risk/raspberry_pi_yamnet.py"
    
    if [ -f "$program_file" ]; then
        print_pass "YAMNet程序文件存在"
        
        # 检查文件大小
        local size=$(du -h "$program_file" | awk '{print $1}')
        print_info "程序文件大小: $size"
        
        # 检查是否可执行
        if [ -x "$program_file" ]; then
            print_pass "程序文件可执行"
        else
            print_warning "程序文件不可执行（但可以通过python3运行）"
        fi
    else
        print_fail "YAMNet程序文件不存在: $program_file"
    fi
}

# 测试10：检查日志文件
test_log_files() {
    print_section "测试10：检查日志文件"
    
    local log_dir="$HOME/sound_ai_risk/logs"
    local log_file="$log_dir/app.log"
    
    if [ -d "$log_dir" ]; then
        print_pass "日志目录存在"
        
        if [ -f "$log_file" ]; then
            local size=$(du -h "$log_file" | awk '{print $1}')
            local lines=$(wc -l < "$log_file")
            print_pass "日志文件存在: $size ($lines 行)"
            
            # 显示最后5行日志
            print_info "最近的日志记录:"
            tail -5 "$log_file" | sed 's/^/  /'
        else
            print_info "日志文件还未创建（在程序首次运行时创建）"
        fi
    else
        print_warning "日志目录不存在（将在程序首次运行时创建）"
    fi
}

# 测试11：系统资源检查
test_system_resources() {
    print_section "测试11：系统资源检查"
    
    # CPU温度
    if [ -f "/sys/class/thermal/thermal_zone0/temp" ]; then
        local cpu_temp=$(cat /sys/class/thermal/thermal_zone0/temp | awk '{print $1/1000}')
        print_info "CPU温度: ${cpu_temp}°C"
        
        if (( $(echo "$cpu_temp > 80" | bc -l) )); then
            print_warning "CPU温度较高，请检查散热"
        else
            print_pass "CPU温度正常"
        fi
    fi
    
    # 内存使用
    local memory=$(free -h | grep Mem | awk '{print $2}')
    local memory_used=$(free -h | grep Mem | awk '{print $3}')
    print_info "内存: $memory_used / $memory"
    
    # 磁盘空间
    local disk=$(df -h ~ | tail -1 | awk '{print $2}')
    local disk_used=$(df -h ~ | tail -1 | awk '{print $3}')
    local disk_available=$(df -h ~ | tail -1 | awk '{print $4}')
    print_info "磁盘: $disk_used / $disk (可用: $disk_available)"
    
    if [ "$disk_available" -lt "1G" ]; then
        print_warning "磁盘空间不足，建议清理"
    else
        print_pass "磁盘空间充足"
    fi
}

# 测试12：快速功能测试
test_quick_functionality() {
    print_section "测试12：快速功能测试（可选）"
    
    read -p "是否进行快速功能测试？(y/n) " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "跳过功能测试"
        return
    fi
    
    local venv_python="$HOME/sound_ai_risk/venv/bin/python3"
    local program_file="$HOME/sound_ai_risk/raspberry_pi_yamnet.py"
    
    if [ -f "$program_file" ]; then
        print_info "启动YAMNet程序进行测试..."
        print_warning "这会录制10秒音频并进行分析"
        
        timeout 30 "$venv_python" "$program_file" 2>&1 | head -20
        
        if [ $? -eq 0 ]; then
            print_pass "功能测试成功"
        else
            print_warning "功能测试超时或出错（可能是网络或配置问题）"
        fi
    else
        print_fail "YAMNet程序文件不存在，无法进行功能测试"
    fi
}

# 生成测试报告
generate_report() {
    print_section "测试总结"
    
    local total=$((TESTS_PASSED + TESTS_FAILED))
    
    echo "总测试数: $total"
    echo -e "${GREEN}通过: $TESTS_PASSED${NC}"
    echo -e "${RED}失败: $TESTS_FAILED${NC}"
    
    echo ""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}✓ 所有测试通过！系统已准备好运行。${NC}"
        echo ""
        echo "后续步骤:"
        echo "1. 编辑配置文件: nano ~/sound_ai_risk/config/config.yaml"
        echo "2. 设置正确的服务器地址和老人信息"
        echo "3. 启动服务: sudo systemctl start sound_ai_risk.service"
        echo "4. 查看日志: sudo journalctl -u sound_ai_risk.service -f"
    else
        echo -e "${YELLOW}有些测试失败，请查看上面的详细信息。${NC}"
        echo ""
        echo "常见问题:"
        echo "1. 如果YAMNet模型未下载，请手动下载或检查网络"
        echo "2. 如果Python依赖缺失，请重新运行自动安装脚本"
        echo "3. 如果麦克风未检测到，请检查硬件连接"
        echo "4. 如果服务器连接失败，请检查配置文件中的地址"
    fi
    
    echo ""
}

# 主函数
main() {
    echo "=========================================="
    echo "声音AI＋疾病与风险预测YAMNet安装验证工具"
    echo "=========================================="
    echo ""
    
    test_directories
    test_yamnet_models
    test_config_file
    test_python_venv
    test_python_packages
    test_audio_devices
    test_network
    test_systemd_service
    test_yamnet_program
    test_log_files
    test_system_resources
    test_quick_functionality
    
    generate_report
}

# 运行主函数
main
