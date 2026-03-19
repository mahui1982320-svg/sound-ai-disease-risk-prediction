#!/bin/bash
# ============================================================
# setup_rpi.sh — 树莓派一键安装脚本
# 用法：bash setup_rpi.sh
# ============================================================
set -e

DEVICE_ID="rpi-001"
API_TOKEN="116b9075617e5a0f5a2591ca967d93e68ba321063e5d03d1773a3fd53202d470"
SERVER_URL="https://eldersafe-fv6io3sc.manus.space"
VENV_DIR="$HOME/yamnet_venv"
SCRIPT_URL="https://eldersafe-fv6io3sc.manus.space/yamnet_uploader.py"

echo "======================================================"
echo "  YAMNet Uploader — Raspberry Pi Setup"
echo "======================================================"

# 1. 确保 python3-venv 已安装
echo "[1/4] Checking python3-venv..."
if ! python3 -m venv --help > /dev/null 2>&1; then
    echo "  Installing python3-venv..."
    sudo apt-get install -y python3-venv python3-full
fi
echo "  OK"

# 2. 创建虚拟环境
echo "[2/4] Creating virtual environment at $VENV_DIR ..."
python3 -m venv "$VENV_DIR"
echo "  OK"

# 3. 安装依赖
echo "[3/4] Installing dependencies (numpy, requests, sounddevice)..."
"$VENV_DIR/bin/pip" install --upgrade pip --quiet
"$VENV_DIR/bin/pip" install numpy requests sounddevice --quiet
echo "  OK"

# 4. 下载脚本（如果当前目录没有）
echo "[4/4] Checking yamnet_uploader.py..."
if [ ! -f "$HOME/yamnet_uploader.py" ]; then
    echo "  Downloading yamnet_uploader.py..."
    curl -fsSL "$SCRIPT_URL" -o "$HOME/yamnet_uploader.py" 2>/dev/null || \
    wget -q "$SCRIPT_URL" -O "$HOME/yamnet_uploader.py"
fi
echo "  OK"

echo ""
echo "======================================================"
echo "  Setup complete!"
echo ""
echo "  Run DEMO mode (no microphone needed):"
echo "  $VENV_DIR/bin/python3 ~/yamnet_uploader.py --demo \\"
echo "    --device-id  $DEVICE_ID \\"
echo "    --api-token  $API_TOKEN"
echo ""
echo "  Run REAL mode (requires yamnet.tflite + microphone):"
echo "  $VENV_DIR/bin/python3 ~/yamnet_uploader.py \\"
echo "    --device-id  $DEVICE_ID \\"
echo "    --api-token  $API_TOKEN \\"
echo "    --server-url $SERVER_URL"
echo "======================================================"
