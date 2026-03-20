#!/bin/bash
# ============================================================================
# 树莓派 YAMNet 监控服务 — 一键更新脚本
# 用法: sudo bash update_service.sh
# ============================================================================

set -e

echo "=========================================="
echo "  YAMNet 监控服务更新脚本"
echo "=========================================="

# 1. 备份当前 service 文件
if [ -f /etc/systemd/system/yamnet-monitor.service ]; then
    cp /etc/systemd/system/yamnet-monitor.service /etc/systemd/system/yamnet-monitor.service.bak
    echo "[OK] 已备份旧的 service 文件"
fi

# 2. 复制新的 service 文件（包含 MD5 自检）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "$SCRIPT_DIR/yamnet-monitor.service" /etc/systemd/system/yamnet-monitor.service
echo "[OK] 已更新 service 文件（含 MD5 自检）"

# 3. 重新加载 systemd 配置
systemctl daemon-reload
echo "[OK] systemd 配置已重新加载"

# 4. 重启服务
systemctl restart yamnet-monitor.service
echo "[OK] 服务已重启"

# 5. 验证服务状态
sleep 3
if systemctl is-active --quiet yamnet-monitor.service; then
    echo "[OK] 服务运行正常"
else
    echo "[ERROR] 服务启动失败，请检查日志: journalctl -u yamnet-monitor -n 20"
    exit 1
fi

# 6. 显示 MD5 校验结果
echo ""
echo "--- MD5 校验信息 ---"
md5sum /home/pi/yamnet_uploader.py
echo ""
echo "--- 服务状态 ---"
systemctl status yamnet-monitor.service --no-pager -l | head -15

echo ""
echo "=========================================="
echo "  更新完成！"
echo "=========================================="
