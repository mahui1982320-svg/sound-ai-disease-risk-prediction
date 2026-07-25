# 🚀 树莓派YAMNet快速开始指南

这是一份简化版的快速开始指南。如需详细信息，请参考 `RASPBERRY_PI_YAMNET_INSTALLATION.md`。

---

## 📦 您需要的文件

在树莓派上，您需要以下文件：

| 文件 | 用途 | 位置 |
|------|------|------|
| `install_yamnet_auto.sh` | 一键自动安装脚本 | 下载到树莓派 |
| `raspberry_pi_yamnet.py` | YAMNet主程序 | 下载到树莓派 |
| `verify_yamnet_installation.sh` | 安装验证脚本 | 下载到树莓派 |
| `RASPBERRY_PI_YAMNET_INSTALLATION.md` | 详细安装指南 | 参考文档 |

---

## ⚡ 5分钟快速安装

### 步骤1：连接到树莓派

```bash
# 通过SSH连接（替换IP地址）
ssh pi@192.168.1.100
# 输入密码：raspberry
```

### 步骤2：下载安装脚本

```bash
# 下载自动安装脚本
wget https://your-server.com/install_yamnet_auto.sh
chmod +x install_yamnet_auto.sh

# 下载YAMNet程序
wget https://your-server.com/raspberry_pi_yamnet.py

# 下载验证脚本
wget https://your-server.com/verify_yamnet_installation.sh
chmod +x verify_yamnet_installation.sh
```

### 步骤3：运行自动安装脚本

```bash
# 运行安装脚本（需要1-2小时）
bash install_yamnet_auto.sh
```

**脚本会自动完成：**
- ✅ 更新系统
- ✅ 安装系统依赖
- ✅ 安装ReSpeaker驱动（如果需要）
- ✅ 创建Python虚拟环境
- ✅ 安装Python依赖
- ✅ 下载YAMNet模型
- ✅ 创建配置文件
- ✅ 设置自动启动

### 步骤4：编辑配置文件

```bash
# 编辑配置文件
nano ~/sound_ai_risk/config/config.yaml
```

**需要修改的部分：**

```yaml
server:
  url: "http://YOUR_SERVER_IP:3000/api/trpc"  # 改为您的服务器地址

elderly:
  id: 30001        # 改为实际的老人ID
  name: "李奶奶"   # 改为实际的老人名字
  room: "101"      # 改为实际的房间号
```

保存：`Ctrl+O` → `Enter` → `Ctrl+X`

### 步骤5：验证安装

```bash
# 运行验证脚本
bash verify_yamnet_installation.sh
```

### 步骤6：启动服务

```bash
# 启动YAMNet服务
sudo systemctl start sound_ai_risk.service

# 查看日志（实时显示）
sudo journalctl -u sound_ai_risk.service -f
```

---

## 🧪 测试YAMNet

### 手动测试（不需要启动服务）

```bash
# 激活虚拟环境
source ~/sound_ai_risk/venv/bin/activate

# 运行程序（会录制10秒音频）
python3 ~/sound_ai_risk/raspberry_pi_yamnet.py
```

**预期输出：**
```
[INFO] YAMNet程序启动
[INFO] 加载模型...
[INFO] 开始监听音频...
[INFO] 正在录制10秒音频...
[INFO] 检测到事件: Cough (咳嗽), 置信度: 0.85
[INFO] 上传结果到服务器...
```

### 检查服务状态

```bash
# 查看服务是否运行
sudo systemctl status sound_ai_risk.service

# 重启服务
sudo systemctl restart sound_ai_risk.service

# 停止服务
sudo systemctl stop sound_ai_risk.service
```

---

## 🔧 常见问题速查

| 问题 | 解决方案 |
|------|--------|
| 无法连接到树莓派 | 检查IP地址，确保树莓派连接到网络 |
| 安装脚本失败 | 检查网络连接，重新运行脚本 |
| 麦克风无法识别 | 检查硬件连接，重新安装驱动 |
| 无法连接到服务器 | 检查配置文件中的服务器地址 |
| 服务无法启动 | 查看日志：`sudo journalctl -u sound_ai_risk.service -n 50` |
| 内存不足 | 关闭不必要的服务，增加交换空间 |

---

## 📋 检查清单

安装完成后，确保以下项目都已完成：

- [ ] 树莓派系统已更新
- [ ] 麦克风驱动已安装
- [ ] Python虚拟环境已创建
- [ ] YAMNet模型已下载
- [ ] 配置文件已编辑
- [ ] 验证脚本显示所有测试通过
- [ ] 服务已启动并运行
- [ ] 日志文件显示正常运行

---

## 🚀 下一步

1. **监控日志** - 定期检查日志，确保系统正常运行
2. **调整参数** - 根据实际情况调整置信度阈值
3. **收集数据** - 运行一周，收集真实数据
4. **优化系统** - 根据数据调整监听事件类型

---

## 📞 需要帮助？

1. 查看详细指南：`cat RASPBERRY_PI_YAMNET_INSTALLATION.md`
2. 运行诊断脚本：`bash verify_yamnet_installation.sh`
3. 查看实时日志：`sudo journalctl -u sound_ai_risk.service -f`

---

**祝您安装顺利！**
