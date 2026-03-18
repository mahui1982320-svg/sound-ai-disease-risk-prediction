#!/bin/bash
# ============================================================
# 树莓派中文环境一键配置脚本
# ============================================================
# 功能：安装中文字体、配置中文语言环境，解决终端中文显示为问号的问题
# 使用方法：sudo bash setup_chinese.sh
# 配置完成后需要重启树莓派才能完全生效
# ============================================================

set -e

echo "============================================================"
echo "  树莓派中文环境配置脚本"
echo "  Raspberry Pi Chinese Environment Setup"
echo "============================================================"
echo ""

# 检查是否以 root 权限运行
if [ "$EUID" -ne 0 ]; then
    echo "[ERROR] Please run with sudo: sudo bash setup_chinese.sh"
    echo "[ERROR] 请使用 sudo 运行: sudo bash setup_chinese.sh"
    exit 1
fi

echo "[1/5] Updating package list / 更新软件源..."
apt-get update -qq

echo ""
echo "[2/5] Installing Chinese fonts / 安装中文字体..."
apt-get install -y \
    fonts-wqy-zenhei \
    fonts-wqy-microhei \
    fonts-noto-cjk \
    2>/dev/null || apt-get install -y fonts-wqy-zenhei fonts-wqy-microhei 2>/dev/null

echo ""
echo "[3/5] Installing locale support / 安装语言环境支持..."
apt-get install -y locales 2>/dev/null

echo ""
echo "[4/5] Generating zh_CN.UTF-8 locale / 生成中文语言环境..."
# 确保 zh_CN.UTF-8 在 locale 列表中
if ! grep -q "^zh_CN.UTF-8" /etc/locale.gen 2>/dev/null; then
    echo "zh_CN.UTF-8 UTF-8" >> /etc/locale.gen
fi
# 确保 en_US.UTF-8 也存在（作为备选）
if ! grep -q "^en_US.UTF-8" /etc/locale.gen 2>/dev/null; then
    echo "en_US.UTF-8 UTF-8" >> /etc/locale.gen
fi
locale-gen

echo ""
echo "[5/5] Setting default locale / 设置默认语言环境..."
# 设置系统默认 locale 为 zh_CN.UTF-8
update-locale LANG=zh_CN.UTF-8 LC_ALL=zh_CN.UTF-8

# 同时写入 /etc/default/locale 确保持久化
cat > /etc/default/locale << 'EOF'
LANG=zh_CN.UTF-8
LC_ALL=zh_CN.UTF-8
LANGUAGE=zh_CN:zh
EOF

# 写入 /etc/environment 确保所有用户都能使用
if ! grep -q "LANG=zh_CN.UTF-8" /etc/environment 2>/dev/null; then
    echo "LANG=zh_CN.UTF-8" >> /etc/environment
fi
if ! grep -q "LC_ALL=zh_CN.UTF-8" /etc/environment 2>/dev/null; then
    echo "LC_ALL=zh_CN.UTF-8" >> /etc/environment
fi

# 为当前用户的 .bashrc 添加编码设置（立即生效用）
BASHRC_FILE="/home/$(logname 2>/dev/null || echo pi)/.bashrc"
if [ -f "$BASHRC_FILE" ]; then
    if ! grep -q "# Chinese locale setup" "$BASHRC_FILE" 2>/dev/null; then
        cat >> "$BASHRC_FILE" << 'EOF'

# Chinese locale setup (added by setup_chinese.sh)
export LANG=zh_CN.UTF-8
export LC_ALL=zh_CN.UTF-8
export LANGUAGE=zh_CN:zh
export PYTHONIOENCODING=utf-8
EOF
        echo "  -> Updated $BASHRC_FILE"
    fi
fi

# 刷新字体缓存
fc-cache -f 2>/dev/null || true

echo ""
echo "============================================================"
echo "  Configuration complete! / 配置完成!"
echo "============================================================"
echo ""
echo "  Please REBOOT your Raspberry Pi to apply changes:"
echo "  请重启树莓派使配置生效："
echo ""
echo "    sudo reboot"
echo ""
echo "  After reboot, verify with / 重启后验证："
echo "    locale              (should show zh_CN.UTF-8)"
echo "    echo '中文测试'      (should display Chinese)"
echo "    python3 -c \"print('中文测试')\"  (should display Chinese)"
echo ""
echo "============================================================"
