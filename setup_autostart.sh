#!/bin/bash
# =============================================================================
# setup_autostart.sh — 居家老人安全监测系统 开机自启动一键安装脚本
# =============================================================================
# 功能：将 yamnet_uploader.py 配置为 systemd 服务，开机自动运行
# 用法：bash setup_autostart.sh
# =============================================================================

set -e

# ── 颜色输出 ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo ""
echo "============================================================"
echo "   居家老人安全监测系统 — 开机自启动安装脚本"
echo "============================================================"
echo ""

# ── 配置参数（可按需修改）────────────────────────────────────────────────────
DEVICE_ID="rpi-001"
API_TOKEN="116b9075617e5a0f5a2591ca967d93e68ba321063e5d03d1773a3fd53202d470"
SERVER_URL="https://eldersafe-fv6io3sc.manus.space"
MODEL_PATH="$HOME/yamnet.tflite"
MIC_DEVICE="3"
VENV_PYTHON="$HOME/yamnet_venv/bin/python3"
SCRIPT_PATH="$HOME/yamnet_uploader.py"
SERVICE_NAME="yamnet-monitor"
LOG_FILE="/var/log/yamnet-monitor.log"

# ── 检查必要文件 ──────────────────────────────────────────────────────────────
info "检查必要文件..."

if [ ! -f "$VENV_PYTHON" ]; then
    error "找不到 Python 虚拟环境: $VENV_PYTHON\n请先运行: python3 -m venv ~/yamnet_venv && ~/yamnet_venv/bin/pip install numpy sounddevice requests tflite-runtime"
fi
success "Python 虚拟环境: $VENV_PYTHON"

if [ ! -f "$MODEL_PATH" ]; then
    warn "找不到 YAMNet 模型: $MODEL_PATH"
    warn "服务会启动但推理会失败，请确保模型文件存在"
else
    success "YAMNet 模型: $MODEL_PATH"
fi

if [ ! -f "$SCRIPT_PATH" ]; then
    info "下载最新版 yamnet_uploader.py..."
    curl -fsSL "https://files.manuscdn.com/user_upload_by_module/session_file/310519663273233586/jWuOYjrumpjzvYVh.py" \
        -o "$SCRIPT_PATH" || error "下载脚本失败，请检查网络连接"
    success "脚本已下载: $SCRIPT_PATH"
else
    success "上报脚本: $SCRIPT_PATH"
fi

# ── 创建日志文件 ──────────────────────────────────────────────────────────────
info "创建日志文件..."
sudo touch "$LOG_FILE"
sudo chown pi:pi "$LOG_FILE" 2>/dev/null || sudo chown "$USER:$USER" "$LOG_FILE"
success "日志文件: $LOG_FILE"

# ── 创建 systemd 服务文件 ─────────────────────────────────────────────────────
info "创建 systemd 服务..."

SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

sudo tee "$SERVICE_FILE" > /dev/null << EOF
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
User=${USER}
WorkingDirectory=${HOME}

# 主程序命令
ExecStart=${VENV_PYTHON} ${SCRIPT_PATH} \\
    --device-id ${DEVICE_ID} \\
    --api-token ${API_TOKEN} \\
    --server-url ${SERVER_URL} \\
    --model ${MODEL_PATH} \\
    --mic-device ${MIC_DEVICE}

# 异常退出后 10 秒自动重启
Restart=on-failure
RestartSec=10

# 标准输出和错误都写入日志
StandardOutput=append:${LOG_FILE}
StandardError=append:${LOG_FILE}

# 环境变量
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
EOF

success "服务文件已创建: $SERVICE_FILE"

# ── 启用并启动服务 ────────────────────────────────────────────────────────────
info "重新加载 systemd 配置..."
sudo systemctl daemon-reload

info "设置开机自启动..."
sudo systemctl enable "${SERVICE_NAME}.service"
success "开机自启动已启用"

info "立即启动服务..."
sudo systemctl start "${SERVICE_NAME}.service"
sleep 3

# ── 检查服务状态 ──────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "   服务状态"
echo "============================================================"

if sudo systemctl is-active --quiet "${SERVICE_NAME}"; then
    success "服务正在运行！"
    echo ""
    sudo systemctl status "${SERVICE_NAME}" --no-pager -l
else
    warn "服务未能正常启动，查看错误信息："
    sudo systemctl status "${SERVICE_NAME}" --no-pager -l
    echo ""
    warn "查看详细日志: sudo journalctl -u ${SERVICE_NAME} -n 50"
fi

# ── 打印常用命令 ──────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "   常用管理命令"
echo "============================================================"
echo ""
echo "  查看实时日志:    sudo journalctl -u ${SERVICE_NAME} -f"
echo "  查看日志文件:    tail -f ${LOG_FILE}"
echo "  查看服务状态:    sudo systemctl status ${SERVICE_NAME}"
echo "  手动停止服务:    sudo systemctl stop ${SERVICE_NAME}"
echo "  手动启动服务:    sudo systemctl start ${SERVICE_NAME}"
echo "  重启服务:        sudo systemctl restart ${SERVICE_NAME}"
echo "  禁用开机自启:    sudo systemctl disable ${SERVICE_NAME}"
echo ""
echo "  Web 管理平台:    https://eldersafe-fv6io3sc.manus.space"
echo ""
echo "============================================================"
echo "   安装完成！树莓派重启后将自动运行监测程序"
echo "============================================================"
echo ""
