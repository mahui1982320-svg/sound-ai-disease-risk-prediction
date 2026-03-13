# 树莓派-云端集成完整指南

## 📋 目录

1. [系统架构](#系统架构)
2. [集成步骤](#集成步骤)
3. [配置说明](#配置说明)
4. [实时数据流](#实时数据流)
5. [故障排查](#故障排查)
6. [性能优化](#性能优化)

---

## 🏗️ 系统架构

### 整体流程

```
树莓派 (边缘计算)
    ↓
采集声音 (麦克风阵列)
    ↓
YAMNet推理 (0-200ms)
    ↓
生成推理结果 (521个分类)
    ↓
上传到云端 (树莓派上传客户端)
    ↓
云端系统 (处理和存储)
    ↓
创建报警记录 (如果需要)
    ↓
管家端仪表板 (实时显示)
    ↓
管家采取行动 (呼叫、派遣等)
```

### 核心组件

| 组件 | 位置 | 功能 | 技术 |
|------|------|------|------|
| **硬件采集** | 树莓派 | 采集声音 | 麦克风阵列 |
| **YAMNet推理** | 树莓派 | 音频分类 | TensorFlow Lite |
| **上传客户端** | 树莓派 | 上传数据 | Python + Requests |
| **API接收** | 云端 | 接收数据 | tRPC |
| **数据存储** | 云端 | 存储推理结果 | MySQL |
| **管家端UI** | 云端 | 显示数据 | React |

---

## 🚀 集成步骤

### 第1步：准备树莓派环境

```bash
# 1. SSH连接到树莓派
ssh pi@raspberry_pi_ip

# 2. 更新系统
sudo apt-get update
sudo apt-get upgrade -y

# 3. 安装必要的依赖
sudo apt-get install -y python3-pip python3-dev
sudo apt-get install -y libatlas-base-dev libjasper-dev libtiff5 libjasper1
sudo apt-get install -y libharfbuzz0b libwebp6 libtiff5 libjasper1 libatlas-base-dev
```

### 第2步：安装YAMNet和依赖

```bash
# 1. 创建项目目录
mkdir -p ~/xiaoyanglaoyao
cd ~/xiaoyanglaoyao

# 2. 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 3. 安装依赖
pip install --upgrade pip
pip install tensorflow-lite
pip install numpy scipy
pip install requests pyyaml
pip install sounddevice soundfile
```

### 第3步：配置树莓派

```bash
# 1. 下载配置文件模板
# 从云端系统下载 config.yaml

# 2. 编辑配置文件
nano ~/xiaoyanglaoyao/config.yaml

# 3. 设置以下信息：
# - device_id: 树莓派的唯一标识
# - device_token: 设备认证令牌
# - elderly_id: 老人的ID
# - server_url: 云端系统的URL
# - api_endpoint: API端点
```

### 第4步：启动YAMNet推理和上传

```bash
# 1. 启动YAMNet推理程序
cd ~/xiaoyanglaoyao
source venv/bin/activate
python3 raspberry_pi_yamnet.py --config config.yaml &

# 2. 启动上传客户端
python3 raspberry_pi_uploader.py --config config.yaml &

# 3. 查看日志
tail -f ~/xiaoyanglaoyao/logs/uploader.log
```

### 第5步：验证集成

```bash
# 1. 检查树莓派是否在线
curl -X GET "https://your-domain.manus.space/api/trpc/raspberryPi.getDeviceStatus?device_id=raspberry_pi_001"

# 2. 查看最新的推理结果
curl -X GET "https://your-domain.manus.space/api/trpc/raspberryPi.getLatestInference?device_id=raspberry_pi_001&limit=10"

# 3. 查看推理统计
curl -X GET "https://your-domain.manus.space/api/trpc/raspberryPi.getInferenceStats?device_id=raspberry_pi_001&time_range=24h"
```

---

## ⚙️ 配置说明

### config.yaml 配置文件

```yaml
device:
  device_id: "raspberry_pi_001"          # 树莓派唯一标识
  device_token: "your_device_token"      # 设备认证令牌

elderly:
  elderly_id: "elder_001"                # 老人ID
  name: "老人名字"                        # 老人名字

server:
  url: "https://your-domain.manus.space" # 云端系统URL
  api_endpoint: "/api/trpc/raspberryPi.uploadInference"

upload:
  interval: 10                           # 上传间隔（秒）
  max_retries: 3                         # 最大重试次数
  retry_delay: 5                         # 重试延迟（秒）
  cache_size: 100                        # 本地缓存大小

inference:
  confidence_threshold: 0.5              # 置信度阈值
  top_k: 3                               # 返回前K个结果
```

### 环境变量

```bash
# 设置环境变量（可选）
export RASPBERRY_PI_CONFIG=/path/to/config.yaml
export RASPBERRY_PI_LOG_DIR=/path/to/logs
export RASPBERRY_PI_DEVICE_TOKEN=your_token
```

---

## 📊 实时数据流

### 数据上传格式

```json
{
  "device_id": "raspberry_pi_001",
  "elderly_id": "elder_001",
  "timestamp": 1710000000000,
  "audio_chunk": {
    "duration": 10,
    "sample_rate": 16000
  },
  "inference_results": [
    {
      "class_id": 123,
      "class_name": "尖叫",
      "confidence": 0.92,
      "event_type": "danger"
    },
    {
      "class_id": 456,
      "class_name": "呼救",
      "confidence": 0.65,
      "event_type": "danger"
    }
  ]
}
```

### 云端处理流程

1. **接收数据** - API接收树莓派上传的数据
2. **验证数据** - 检查设备ID、令牌、数据格式
3. **判断警报** - 根据置信度判断是否需要创建警报
4. **存储数据** - 将推理结果存储到数据库
5. **创建警报** - 如果需要，创建报警记录
6. **推送通知** - 将警报推送给管家端
7. **返回响应** - 返回处理结果给树莓派

### 响应格式

```json
{
  "success": true,
  "alarm_id": 12345,
  "message": "警报已创建 - 尖叫",
  "primary_event": "尖叫",
  "confidence": 0.92,
  "event_type": "danger"
}
```

---

## 🔧 故障排查

### 问题1：树莓派无法连接到云端

**症状**：上传失败，日志显示"Connection Error"

**解决方案**：
```bash
# 1. 检查网络连接
ping 8.8.8.8

# 2. 检查DNS解析
nslookup your-domain.manus.space

# 3. 检查防火墙
sudo ufw status

# 4. 测试HTTPS连接
curl -v https://your-domain.manus.space/api/trpc/raspberryPi.getDeviceStatus
```

### 问题2：YAMNet推理速度慢

**症状**：推理时间>500ms，无法实时处理

**解决方案**：
```bash
# 1. 检查树莓派资源使用
top
free -h
df -h

# 2. 优化YAMNet配置
# - 减少top_k值（从3改为1）
# - 增加confidence_threshold（从0.5改为0.7）
# - 使用量化模型（int8而非float32）

# 3. 增加树莓派内存
# - 使用树莓派4B（4GB或8GB）
# - 关闭不必要的服务
```

### 问题3：上传数据丢失

**症状**：某些推理结果没有上传到云端

**解决方案**：
```bash
# 1. 检查本地缓存
ls -lh ~/xiaoyanglaoyao/cache/

# 2. 查看上传日志
tail -100 ~/xiaoyanglaoyao/logs/uploader.log | grep -E "ERROR|FAILED"

# 3. 手动重试上传
python3 raspberry_pi_uploader.py --retry-cache

# 4. 增加缓存大小
# 编辑config.yaml，将cache_size从100改为500
```

### 问题4：误报率高

**症状**：很多不是真实危险的声音被识别为危险信号

**解决方案**：
```bash
# 1. 调整置信度阈值
# 编辑config.yaml，将confidence_threshold从0.5改为0.7

# 2. 调整事件类型阈值
# 在云端系统中调整danger_threshold（从0.75改为0.85）

# 3. 收集训练数据
# 记录误报的音频，用于模型微调

# 4. 更新YAMNet模型
# 使用更新的模型版本或微调的模型
```

---

## 📈 性能优化

### 1. 边缘计算优化

```python
# 使用TensorFlow Lite量化模型
interpreter = tf.lite.Interpreter(model_path="yamnet_quantized.tflite")

# 使用多线程处理
from concurrent.futures import ThreadPoolExecutor
executor = ThreadPoolExecutor(max_workers=2)
```

### 2. 网络优化

```python
# 批量上传数据
batch_size = 10
if len(upload_queue) >= batch_size:
    uploader.batch_upload(upload_queue)

# 使用连接池
session = requests.Session()
adapter = requests.adapters.HTTPAdapter(pool_connections=5, pool_maxsize=10)
session.mount('https://', adapter)
```

### 3. 存储优化

```python
# 本地缓存压缩
import gzip
with gzip.open('cache.gz', 'wb') as f:
    f.write(json.dumps(data).encode())

# 定期清理过期数据
def cleanup_old_cache(max_age_hours=24):
    for file in cache_dir.glob('*.json'):
        if (time.time() - file.stat().st_mtime) > max_age_hours * 3600:
            file.unlink()
```

### 4. 监控和告警

```python
# 监控系统健康状态
def monitor_system_health():
    cpu_usage = psutil.cpu_percent()
    memory_usage = psutil.virtual_memory().percent
    disk_usage = psutil.disk_usage('/').percent
    
    if cpu_usage > 80 or memory_usage > 80:
        logger.warning(f"系统资源紧张: CPU={cpu_usage}%, MEM={memory_usage}%")
    
    return {
        'cpu': cpu_usage,
        'memory': memory_usage,
        'disk': disk_usage
    }
```

---

## 📚 相关文档

- [树莓派YAMNet安装指南](./RASPBERRY_PI_YAMNET_INSTALLATION.md)
- [YAMNet实时音频分类](./YAMNET_REALTIME_AUDIO_CLASSIFICATION.md)
- [系统架构设计](./ARCHITECTURE_INTEGRATION_SIMPLE.md)
- [硬件集成指南](./HARDWARE_INTEGRATION_GUIDE_FOR_NON_TECH.md)

---

## 🎯 下一步

1. **部署到生产环境** - 在实际的养老院部署系统
2. **收集真实数据** - 运行一周以上，收集真实的音频数据
3. **模型微调** - 基于真实数据微调YAMNet模型
4. **性能评估** - 评估系统的准确率、误报率、响应时间
5. **持续改进** - 根据反馈不断优化系统

---

## 📞 技术支持

如有问题，请查看以下资源：

- 日志文件：`~/xiaoyanglaoyao/logs/`
- 配置文件：`~/xiaoyanglaoyao/config.yaml`
- 测试脚本：`verify_yamnet_installation.sh`
- 云端API文档：`/api/docs`

---

**最后更新**：2026年3月13日
**版本**：1.0.0
