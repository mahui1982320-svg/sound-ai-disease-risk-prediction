# 树莓派-云端集成快速开始指南

## 🎯 5分钟快速上手

### 前置条件

- ✅ 树莓派已安装YAMNet（参考 `RASPBERRY_PI_YAMNET_INSTALLATION.md`）
- ✅ 云端系统已部署（本项目）
- ✅ 树莓派和云端系统网络连通
- ✅ 已获得设备认证令牌（device_token）

---

## 🚀 快速集成步骤

### 第1步：下载集成文件（1分钟）

```bash
# 在树莓派上执行
cd ~/xiaoyanglaoyao

# 从云端系统下载文件
curl -O https://your-domain.manus.space/files/raspberry_pi_uploader.py
curl -O https://your-domain.manus.space/files/config.yaml
curl -O https://your-domain.manus.space/files/requirements.txt
```

### 第2步：配置系统（1分钟）

```bash
# 编辑config.yaml
nano config.yaml

# 修改以下内容：
# device_id: raspberry_pi_001          # 改为您的树莓派ID
# device_token: your_device_token      # 改为您的认证令牌
# elderly_id: elder_001                # 改为老人ID
# server_url: https://your-domain.manus.space  # 改为您的服务器地址
```

### 第3步：安装依赖（1分钟）

```bash
# 激活虚拟环境
source ~/xiaoyanglaoyao/venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 第4步：启动上传客户端（1分钟）

```bash
# 启动上传客户端
python3 raspberry_pi_uploader.py --config config.yaml

# 或者在后台运行
nohup python3 raspberry_pi_uploader.py --config config.yaml > uploader.log 2>&1 &
```

### 第5步：验证集成（1分钟）

```bash
# 检查日志
tail -f uploader.log

# 应该看到类似的输出：
# [2026-03-13 10:00:00] INFO - 上传客户端初始化完成
# [2026-03-13 10:00:01] INFO - ✓ 上传成功 - 尖叫 (92.0%)
# [2026-03-13 10:00:02] INFO - ✓ 上传成功 - 咳嗽 (88.0%)
```

---

## 📊 实时查看数据

### 在管家端仪表板查看

1. 打开管家端应用
2. 进入 **报警管理** 页面
3. 查看最新的报警记录
4. 点击任何报警记录查看YAMNet推理详情

### 通过API查询

```bash
# 查询最新的推理结果
curl "https://your-domain.manus.space/api/trpc/raspberryPi.getLatestInference?device_id=raspberry_pi_001&limit=10"

# 查询推理统计
curl "https://your-domain.manus.space/api/trpc/raspberryPi.getInferenceStats?device_id=raspberry_pi_001&time_range=24h"

# 查询设备状态
curl "https://your-domain.manus.space/api/trpc/raspberryPi.getDeviceStatus?device_id=raspberry_pi_001"
```

---

## 🧪 测试模式

### 运行测试上传

```bash
# 模拟YAMNet推理结果并上传
python3 raspberry_pi_uploader.py --config config.yaml --test

# 输出示例：
# ======================================================================
# 测试模式 - 模拟YAMNet推理结果上传
# ======================================================================
#
# [测试 1] 处理推理结果...
#   主要事件: 尖叫
#   置信度: 92.0%
#   上传中...
# ✓ 上传成功 - 尖叫 (92.0%)
#
# [测试 2] 处理推理结果...
#   主要事件: 咳嗽
#   置信度: 88.0%
#   上传中...
# ✓ 上传成功 - 咳嗽 (88.0%)
#
# ======================================================================
# 上传统计信息
# ======================================================================
# 设备ID:          raspberry_pi_001
# 老人ID:          elder_001
# 成功上传:        2 条
# 失败上传:        0 条
# 缓存数据:        0 条
# 最后上传时间:    2026-03-13T10:00:00
# 最后错误:        无
# ======================================================================
```

---

## 🔍 常见命令

### 查看上传状态

```bash
# 查看实时日志
tail -f ~/xiaoyanglaoyao/logs/uploader.log

# 查看最近100条日志
tail -100 ~/xiaoyanglaoyao/logs/uploader.log

# 搜索错误
grep ERROR ~/xiaoyanglaoyao/logs/uploader.log

# 统计上传成功数
grep "✓ 上传成功" ~/xiaoyanglaoyao/logs/uploader.log | wc -l
```

### 管理进程

```bash
# 查看运行的进程
ps aux | grep raspberry_pi

# 停止上传客户端
pkill -f "python3 raspberry_pi_uploader.py"

# 重启上传客户端
pkill -f "python3 raspberry_pi_uploader.py"
python3 raspberry_pi_uploader.py --config config.yaml &
```

### 检查系统状态

```bash
# 查看树莓派资源使用
top

# 查看内存使用
free -h

# 查看磁盘使用
df -h

# 查看网络连接
netstat -an | grep ESTABLISHED
```

---

## ⚠️ 常见问题

### Q1：上传失败，显示"Connection Error"

**A：** 检查网络连接和服务器地址

```bash
# 测试网络连接
ping 8.8.8.8

# 测试DNS解析
nslookup your-domain.manus.space

# 测试HTTPS连接
curl -v https://your-domain.manus.space/api/trpc/raspberryPi.getDeviceStatus
```

### Q2：上传失败，显示"Unauthorized"

**A：** 检查device_token是否正确

```bash
# 查看config.yaml中的device_token
cat config.yaml | grep device_token

# 确保与云端系统中注册的token一致
```

### Q3：推理结果没有显示在仪表板上

**A：** 检查老人ID是否正确

```bash
# 查看config.yaml中的elderly_id
cat config.yaml | grep elderly_id

# 确保与云端系统中的老人ID一致
```

### Q4：上传速度很慢

**A：** 检查网络延迟和树莓派资源

```bash
# 测试网络延迟
ping -c 10 your-domain.manus.space

# 查看树莓派资源使用
top
free -h

# 如果资源紧张，尝试：
# 1. 增加upload_interval（从10改为30秒）
# 2. 减少top_k值（从3改为1）
# 3. 增加confidence_threshold（从0.5改为0.7）
```

---

## 📈 性能指标

### 预期性能

| 指标 | 预期值 |
|------|--------|
| 推理时间 | 100-200ms |
| 上传延迟 | 1-3秒 |
| 总响应时间 | 2-5秒 |
| 准确率 | 85-95% |
| 误报率 | 5-15% |

### 监控指标

```bash
# 查看上传成功率
grep "✓ 上传成功" ~/xiaoyanglaoyao/logs/uploader.log | wc -l
grep "✗" ~/xiaoyanglaoyao/logs/uploader.log | wc -l

# 计算成功率
success=$(grep "✓ 上传成功" ~/xiaoyanglaoyao/logs/uploader.log | wc -l)
failed=$(grep "✗" ~/xiaoyanglaoyao/logs/uploader.log | wc -l)
total=$((success + failed))
rate=$((success * 100 / total))
echo "上传成功率: $rate%"
```

---

## 🎯 下一步

1. **配置告警规则** - 在管家端设置告警规则
2. **测试实际场景** - 在老人家里运行一周
3. **收集反馈** - 记录误报和漏报情况
4. **优化模型** - 基于反馈调整置信度阈值
5. **扩展部署** - 部署到更多老人家里

---

## 📚 详细文档

- [完整集成指南](./RASPBERRY_PI_CLOUD_INTEGRATION_GUIDE.md)
- [树莓派YAMNet安装](./RASPBERRY_PI_YAMNET_INSTALLATION.md)
- [YAMNet实时分类](./YAMNET_REALTIME_AUDIO_CLASSIFICATION.md)
- [系统架构设计](./ARCHITECTURE_INTEGRATION_SIMPLE.md)

---

**版本**：1.0.0  
**最后更新**：2026年3月13日
