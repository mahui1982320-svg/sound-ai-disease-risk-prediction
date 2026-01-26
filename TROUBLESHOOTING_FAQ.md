# 常见问题解决指南（FAQ）

## 🔴 严重问题

### 问题 1：树莓派完全无法启动（没有任何 LED 灯亮起）

**症状：**
- 连接电源后，所有 LED 灯都不亮
- 没有任何声音或反应

**可能原因：**
1. 电源适配器故障或功率不足
2. 树莓派硬件损坏
3. 电源线接触不良

**解决步骤：**

```
第一步：检查电源适配器
├─ 用万用表测量电压（应该是 5V）
├─ 如果不是 5V，更换电源适配器
└─ 如果是 5V，继续第二步

第二步：检查电源线
├─ 尝试不同的电源线
├─ 确保连接牢固
└─ 如果还是不行，继续第三步

第三步：尝试不同的 USB-C 接口
├─ 如果树莓派有多个 USB-C 接口，尝试其他接口
└─ 如果都不行，可能是硬件损坏

第四步：联系卖家
├─ 提供购买凭证
├─ 描述问题和已尝试的解决方案
└─ 申请退货或换货
```

**预防措施：**
- 购买正品电源适配器（5V/3A 以上）
- 定期检查电源线是否损坏
- 避免在潮湿环境中使用

---

### 问题 2：树莓派启动后突然断电或重启

**症状：**
- 树莓派启动几秒后自动关闭
- 反复重启，无法正常工作

**可能原因：**
1. 电源功率不足（最常见）
2. 电源线接触不良
3. microSD 卡损坏
4. 系统过热

**解决步骤：**

```bash
# 第一步：检查电源功率
# 确保电源适配器是 5V/3A 以上
# 查看适配器标签或说明书

# 第二步：检查电源线
# 尝试不同的电源线和接口

# 第三步：检查系统温度
vcgencmd measure_temp
# 如果温度超过 80°C，说明过热

# 第四步：重新写入系统
# 使用 Raspberry Pi Imager 重新写入操作系统
```

**预防措施：**
- 使用功率足够的电源适配器
- 安装散热器和风扇
- 定期检查系统温度

---

### 问题 3：ReSpeaker 麦克风完全无法识别

**症状：**
- ReSpeaker 上的 LED 灯不亮
- 运行 `arecord -l` 看不到 seeed-2mic 设备

**可能原因：**
1. ReSpeaker 没有完全插入 GPIO 接头
2. GPIO 接头接触不良
3. ReSpeaker 驱动程序未安装
4. ReSpeaker 硬件损坏

**解决步骤：**

```bash
# 第一步：检查物理连接
# 1. 关闭树莓派电源
# 2. 重新拔出 ReSpeaker
# 3. 用清洁布轻轻擦拭 GPIO 接头和 ReSpeaker 插针
# 4. 重新插入 ReSpeaker，确保完全接触
# 5. 启动树莓派

# 第二步：检查 LED 灯
# 如果 LED 灯还是不亮，继续第三步

# 第三步：重新安装驱动程序
git clone https://github.com/respeaker/seeed-voicecard.git
cd seeed-voicecard
sudo ./install.sh
sudo reboot

# 第四步：验证安装
arecord -l
# 应该看到：card 1: seeed2micvoicec [seeed-2mic-voicecard]
```

**预防措施：**
- 定期检查 GPIO 接头是否接触良好
- 避免在潮湿环境中使用
- 定期更新驱动程序

---

## 🟠 主要问题

### 问题 4：无法通过 SSH 连接到树莓派

**症状：**
- SSH 连接超时
- 连接被拒绝

**可能原因：**
1. 树莓派 IP 地址不正确
2. SSH 服务未启动
3. 网络连接不通
4. 防火墙阻止

**解决步骤：**

```bash
# 第一步：找到树莓派的 IP 地址
# 在路由器管理界面查看连接的设备
# 或者在电脑上运行：
arp-scan -l
# 查找 MAC 地址为 b8:27:eb 开头的设备

# 第二步：测试网络连通性
ping <树莓派IP地址>
# 如果无响应，检查网络连接

# 第三步：检查 SSH 服务
# 在树莓派上运行（需要显示器和键盘）：
sudo systemctl status ssh
# 如果未启动，运行：
sudo systemctl start ssh
sudo systemctl enable ssh

# 第四步：尝试连接
ssh pi@<树莓派IP地址>
# 输入密码（默认为 raspberry）
```

**预防措施：**
- 记录树莓派的 IP 地址
- 定期检查 SSH 服务状态
- 配置静态 IP 地址

---

### 问题 5：音频录制没有声音

**症状：**
- 运行录音命令后，文件大小为 0 或很小
- 播放录音文件没有声音

**可能原因：**
1. 麦克风音量太低
2. 麦克风设备选择错误
3. 麦克风损坏

**解决步骤：**

```bash
# 第一步：检查麦克风设备
arecord -l
# 找到 ReSpeaker 设备（通常是 card 1）

# 第二步：调整麦克风音量
amixer set Capture 100
# 或者使用 alsamixer 图形界面：
alsamixer

# 第三步：测试录音
arecord -D hw:1,0 -f cd -t wav test.wav -d 5
# 对着麦克风说话

# 第四步：播放录音
aplay test.wav
# 检查是否有声音

# 如果还是没有声音，尝试不同的设备：
arecord -D hw:1,1 -f cd -t wav test.wav -d 5
```

**预防措施：**
- 定期检查麦克风音量
- 定期测试麦克风功能
- 避免麦克风进水或受潮

---

### 问题 6：网络连接不稳定

**症状：**
- 间歇性无法连接网络
- 网速很慢
- 经常断线

**可能原因：**
1. WiFi 信号弱
2. 网线接触不良
3. 网络配置错误
4. 路由器问题

**解决步骤：**

```bash
# 第一步：检查网络连接
ip addr
# 查看是否有 IP 地址

# 第二步：测试网络连通性
ping 8.8.8.8
# 如果无响应，检查网络连接

# 第三步：检查 DNS 解析
nslookup google.com
# 如果无法解析，检查 DNS 设置

# 第四步：重启网络
sudo systemctl restart networking

# 第五步：检查网络日志
sudo journalctl -u networking -f
```

**预防措施：**
- 使用有线网络（比 WiFi 更稳定）
- 将树莓派放在路由器附近
- 定期重启路由器
- 更新网络驱动程序

---

### 问题 7：YAMNet 模型加载失败

**症状：**
- 运行监控脚本时出现 TensorFlow 错误
- 模型加载超时

**可能原因：**
1. 模型文件未正确下载
2. 模型文件损坏
3. TensorFlow 版本不兼容
4. 内存不足

**解决步骤：**

```bash
# 第一步：检查模型文件
ls -lah ~/yamnet_model/
# 应该看到以下文件：
# - yamnet.tflite (约 100MB)
# - yamnet_labels.txt
# - yamnet_model.tflite

# 第二步：验证模型文件完整性
md5sum ~/yamnet_model/yamnet.tflite
# 与官方 MD5 值比对

# 第三步：重新下载模型
cd ~/yamnet_model
wget https://storage.googleapis.com/download.tensorflow.org/models/tflite/yamnet_classification_tflite_1.tar.gz
tar -xzf yamnet_classification_tflite_1.tar.gz

# 第四步：检查 TensorFlow 版本
python3 -c "import tensorflow; print(tensorflow.__version__)"
# 应该是 2.x 版本

# 第五步：检查内存
free -h
# 确保有至少 500MB 可用内存
```

**预防措施：**
- 定期验证模型文件完整性
- 保持 TensorFlow 最新版本
- 定期清理磁盘空间

---

## 🟡 次要问题

### 问题 8：报警无法上传到后端

**症状：**
- 监控脚本检测到事件但没有上传
- 后端没有收到报警

**可能原因：**
1. 后端服务器不可用
2. 网络连接问题
3. API 端点配置错误
4. 防火墙阻止

**解决步骤：**

```bash
# 第一步：检查网络连接
ping 8.8.8.8
# 确保网络正常

# 第二步：测试后端服务器
curl -v <后端URL>
# 检查是否能连接到后端

# 第三步：检查 API 端点
curl -X POST <后端URL>/api/trpc/alarms.upload \
  -H "Content-Type: application/json" \
  -d '{"elderlyId": 30001, "eventType": "fall", "confidence": 0.85}'

# 第四步：查看监控日志
tail -f ~/elderly_monitor.log
# 查看上传失败的原因

# 第五步：检查防火墙
sudo ufw status
# 如果启用了防火墙，需要打开相应的端口
```

**预防措施：**
- 定期测试后端服务器连通性
- 记录 API 端点 URL
- 配置日志记录功能

---

### 问题 9：系统资源占用过高

**症状：**
- CPU 使用率超过 80%
- 内存使用率超过 80%
- 系统反应很慢

**可能原因：**
1. 监控脚本运行多个实例
2. 其他后台进程占用资源
3. 磁盘 I/O 过高
4. 内存泄漏

**解决步骤：**

```bash
# 第一步：查看进程占用
top
# 按 CPU 或内存排序，查看占用最高的进程

# 第二步：查看监控脚本进程数
ps aux | grep elderly_monitor
# 如果有多个实例，杀死多余的
kill -9 <进程ID>

# 第三步：查看磁盘 I/O
iostat -x 1
# 如果磁盘 I/O 很高，可能是磁盘问题

# 第四步：清理日志文件
sudo journalctl --vacuum=time=7d
# 清理 7 天前的日志

# 第五步：重启系统
sudo reboot
```

**预防措施：**
- 定期监控系统资源
- 配置日志轮转
- 禁用不必要的服务

---

### 问题 10：树莓派过热

**症状：**
- CPU 温度超过 80°C
- 系统自动降频或关闭
- 风扇持续高速运转

**可能原因：**
1. 没有安装散热器
2. 散热器接触不良
3. 环境温度过高
4. 系统负载过高

**解决步骤：**

```bash
# 第一步：检查 CPU 温度
vcgencmd measure_temp
# 记录当前温度

# 第二步：检查散热器
# 1. 关闭树莓派
# 2. 检查散热器是否贴紧
# 3. 重新安装散热器（如果需要）

# 第三步：改善散热环境
# 1. 将树莓派放在通风的地方
# 2. 增加风扇
# 3. 降低环境温度

# 第四步：降低系统负载
# 1. 关闭不必要的服务
# 2. 降低 CPU 频率（如果需要）
# 3. 增加内存（如果需要）

# 第五步：监控温度
# 每分钟记录一次温度
watch -n 60 vcgencmd measure_temp
```

**预防措施：**
- 安装散热器和风扇
- 定期清理灰尘
- 避免在高温环境中使用
- 定期监控温度

---

## 🟢 轻微问题

### 问题 11：LED 灯不亮或闪烁异常

**症状：**
- LED 灯完全不亮
- LED 灯闪烁不规律

**可能原因：**
1. LED 灯故障
2. GPIO 接头接触不良
3. 软件配置问题

**解决步骤：**

```bash
# 第一步：检查 LED 灯是否点亮
# 在黑暗环境中观察

# 第二步：检查 GPIO 接头
# 重新拔出和插入 ReSpeaker

# 第三步：查看系统日志
dmesg | tail -20

# 第四步：如果 LED 灯完全不亮
# 可能是硬件故障，联系卖家
```

---

### 问题 12：监控脚本占用磁盘空间过多

**症状：**
- 磁盘空间快满了
- 日志文件很大

**可能原因：**
1. 日志文件没有轮转
2. 临时文件没有清理
3. 模型文件重复下载

**解决步骤：**

```bash
# 第一步：查看磁盘使用情况
df -h
du -sh ~/*

# 第二步：清理日志文件
sudo journalctl --vacuum=time=7d
rm ~/elderly_monitor.log

# 第三步：清理临时文件
sudo apt-get clean
rm -rf ~/tmp/*

# 第四步：配置日志轮转
sudo nano /etc/logrotate.d/elderly_monitor
# 添加以下内容：
# /home/pi/elderly_monitor.log {
#     daily
#     rotate 7
#     compress
#     delaycompress
#     notifempty
# }
```

---

## 📞 获取帮助

### 如果问题仍未解决

1. **收集诊断信息**
   ```bash
   # 生成诊断报告
   uname -a > /tmp/diagnostic.txt
   vcgencmd measure_temp >> /tmp/diagnostic.txt
   free -h >> /tmp/diagnostic.txt
   df -h >> /tmp/diagnostic.txt
   arecord -l >> /tmp/diagnostic.txt
   dmesg | tail -50 >> /tmp/diagnostic.txt
   ```

2. **收集日志文件**
   ```bash
   tail -100 ~/elderly_monitor.log > /tmp/app.log
   sudo journalctl -n 100 > /tmp/system.log
   ```

3. **联系技术支持**
   - 淘宝卖家客服
   - 矽递科技：support@seeedstudio.com
   - 树莓派论坛：https://forums.raspberrypi.com/

4. **提供以下信息**
   - 诊断报告
   - 日志文件
   - 问题描述和重现步骤
   - 已尝试的解决方案

---

**祝您问题解决顺利！**
