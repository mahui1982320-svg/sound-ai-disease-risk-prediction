# 快速参考卡

## 🚀 快速启动（5 分钟）

### 硬件启动
```
1. 连接电源 → 等待 30 秒
2. 观察红色 LED 亮起（电源正常）
3. 观察绿色 LED 闪烁（系统运行）
4. 连接网线或 WiFi
```

### 系统启动
```bash
# SSH 连接到树莓派
ssh pi@<树莓派IP地址>

# 启动监控脚本
python3 ~/elderly_monitor.py
```

### 验证运行
```bash
# 查看监控日志
tail -f ~/elderly_monitor.log

# 查看报警记录
curl http://localhost:3000/api/trpc/alarms.list
```

---

## 🔍 快速诊断

### 问题排查流程

```
问题：树莓派无法启动
├─ 检查电源指示灯（红色）
│  ├─ 不亮 → 更换电源适配器
│  └─ 亮起 → 继续
├─ 检查系统指示灯（绿色）
│  ├─ 不闪烁 → 重新插入 microSD 卡
│  └─ 闪烁 → 系统正常

问题：ReSpeaker 无法识别
├─ 检查 LED 灯是否亮起
│  ├─ 不亮 → 重新插入 ReSpeaker
│  └─ 亮起 → 继续
├─ 运行命令：arecord -l
│  ├─ 看不到 seeed-2mic → 重新安装驱动
│  └─ 看到 seeed-2mic → 麦克风正常

问题：无法连接网络
├─ 检查网线连接
├─ 运行命令：ping 8.8.8.8
│  ├─ 无响应 → 重启网络
│  └─ 有响应 → 网络正常
└─ 检查 DNS：nslookup google.com

问题：报警无法上传
├─ 检查网络连接：ping <后端服务器>
├─ 检查 API 端点：curl <后端URL>
├─ 查看监控日志：tail -f ~/elderly_monitor.log
└─ 检查防火墙设置
```

---

## 📞 常用命令速查表

| 功能 | 命令 | 说明 |
|------|------|------|
| **系统信息** | `uname -a` | 查看系统信息 |
| | `vcgencmd measure_temp` | 查看 CPU 温度 |
| | `free -h` | 查看内存使用情况 |
| | `df -h` | 查看磁盘使用情况 |
| **网络** | `ip addr` | 查看 IP 地址 |
| | `ping 8.8.8.8` | 测试网络连通性 |
| | `nslookup google.com` | 测试 DNS 解析 |
| | `sudo systemctl restart networking` | 重启网络 |
| **音频** | `arecord -l` | 列出音频设备 |
| | `arecord -D hw:1,0 -f cd -t wav test.wav -d 5` | 录制 5 秒音频 |
| | `aplay test.wav` | 播放音频 |
| | `amixer set Capture 80` | 调整音量 |
| **进程** | `ps aux` | 查看所有进程 |
| | `ps aux \| grep elderly_monitor` | 查看监控进程 |
| | `kill -9 <进程ID>` | 杀死进程 |
| | `top` | 实时监控进程 |
| **文件** | `ls -la` | 列出文件 |
| | `cat <文件名>` | 查看文件内容 |
| | `tail -f <文件名>` | 实时查看文件末尾 |
| | `nano <文件名>` | 编辑文件 |

---

## 🔧 常见问题速查

### Q1：树莓派启动后无反应
**A：** 
1. 检查电源适配器功率（需要 5V/3A 以上）
2. 重新拔出和插入 microSD 卡
3. 使用 Raspberry Pi Imager 重新写入系统

### Q2：ReSpeaker 麦克风无法识别
**A：**
```bash
# 重新安装驱动
git clone https://github.com/respeaker/seeed-voicecard.git
cd seeed-voicecard
sudo ./install.sh
sudo reboot
```

### Q3：无法通过 SSH 连接
**A：**
1. 确认树莓派 IP 地址：`arp-scan -l`
2. 确认网络连接：`ping <树莓派IP>`
3. 检查 SSH 服务：`sudo systemctl status ssh`

### Q4：音频录制没有声音
**A：**
1. 检查麦克风是否正确安装
2. 调整音量：`amixer set Capture 100`
3. 测试不同的设备：`arecord -D hw:1,0 -f cd -t wav test.wav -d 5`

### Q5：报警无法上传
**A：**
1. 检查网络连接：`ping 8.8.8.8`
2. 检查后端服务器：`curl <后端URL>`
3. 查看监控日志：`tail -f ~/elderly_monitor.log`
4. 检查防火墙设置

### Q6：树莓派过热
**A：**
1. 安装散热器和风扇
2. 检查 CPU 温度：`vcgencmd measure_temp`
3. 将树莓派放在通风的地方
4. 关闭不必要的服务

### Q7：磁盘空间不足
**A：**
```bash
# 查看磁盘使用情况
df -h

# 清理日志文件
sudo journalctl --vacuum=time=7d

# 清理包缓存
sudo apt-get clean
```

### Q8：系统启动很慢
**A：**
1. 检查磁盘健康状况：`sudo fsck -n /dev/mmcblk0p2`
2. 禁用不必要的服务
3. 升级到更快的 microSD 卡

---

## 📊 性能基准

### 硬件性能指标

| 指标 | 树莓派 4B | 香橙派 5 |
|------|---------|---------|
| CPU | Cortex-A72 4核 | Cortex-A76 8核 |
| 内存 | 4GB/8GB | 4GB/8GB/16GB |
| 存储 | microSD | eMMC/microSD |
| 功耗 | 5W-10W | 10W-15W |
| 推理速度 | 100-200ms | 50-100ms |

### 系统资源占用

| 组件 | CPU 占用 | 内存占用 | 磁盘占用 |
|------|---------|---------|---------|
| 操作系统 | 5% | 200MB | 2GB |
| YAMNet 模型 | 30% | 100MB | 100MB |
| 监控脚本 | 20% | 50MB | 10MB |
| 总计 | 55% | 350MB | 2.1GB |

---

## 🎯 部署检查清单

### 采购阶段
- [ ] 树莓派 4B（4GB 或 8GB）
- [ ] ReSpeaker 4-Mic Array
- [ ] 电源适配器（5V/3A+）
- [ ] microSD 卡（64GB+）
- [ ] 散热器和风扇
- [ ] 网线

### 组装阶段
- [ ] 安装散热器
- [ ] 安装 ReSpeaker
- [ ] 安装 microSD 卡
- [ ] 连接电源和网络

### 系统配置
- [ ] 安装操作系统
- [ ] 配置网络连接
- [ ] 安装 Python 依赖
- [ ] 下载 YAMNet 模型
- [ ] 配置监控脚本

### 测试验证
- [ ] 电源和指示灯正常
- [ ] 网络连接正常
- [ ] 麦克风录音正常
- [ ] YAMNet 模型加载成功
- [ ] 报警上传成功
- [ ] 管家端显示报警

### 上线部署
- [ ] 配置开机自启
- [ ] 设置日志轮转
- [ ] 配置监控告警
- [ ] 备份配置文件
- [ ] 文档和培训

---

## 🆘 紧急联系方式

### 技术支持
- **淘宝卖家客服**：在购买页面点击"联系卖家"
- **矽递科技客服**：support@seeedstudio.com
- **树莓派官方论坛**：https://forums.raspberrypi.com/

### 常用链接
- **树莓派官网**：https://www.raspberrypi.com/
- **ReSpeaker Wiki**：https://wiki.seeedstudio.com/ReSpeaker_4-Mic_Array_for_Raspberry_Pi/
- **YAMNet 文档**：https://github.com/tensorflow/models/tree/master/research/audioset/yamnet

### 应急处理
1. **系统无法启动**：尝试重新写入操作系统
2. **麦克风无法识别**：重新安装驱动程序
3. **网络无法连接**：检查网线和网络配置
4. **报警无法上传**：检查后端服务器和防火墙

---

## 📝 日志记录

### 监控脚本日志位置
```
~/elderly_monitor.log
```

### 查看最近 100 行日志
```bash
tail -100 ~/elderly_monitor.log
```

### 实时查看日志
```bash
tail -f ~/elderly_monitor.log
```

### 查看特定时间的日志
```bash
grep "2026-01-23" ~/elderly_monitor.log
```

---

**需要帮助？请参考完整文档或联系技术支持。**
