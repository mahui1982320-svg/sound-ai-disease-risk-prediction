# 声音 AI＋疾病与风险预测

<p align="center">
  <img src="assets/cover.png" alt="声音 AI＋疾病与风险预测：树莓派与麦克风感知居家风险声音" width="100%" />
</p>

> 基于边缘音频感知、风险信号分析与人工复核的居家风险预警系统。

## 项目定位

系统通过树莓派和麦克风阵列在本地分析环境声音，识别需要关注的声音事件（例如跌倒、呼救、尖叫等），将报警与必要的音频片段上传到服务端，再由管家端进行人工复核、风险记录和处置。项目中的模型输出仅可作为疾病与风险预测的辅助信号，不能作为诊断结论。

它是辅助预警工具，不能替代人工照护、紧急医疗服务或专业安全设备。任何报警阈值和处置流程都应由实际运营方根据场景评估。

## 系统组成

```text
树莓派 + 麦克风阵列
        │ 本地音频采集 / YAMNet 推理
        ▼
报警上报接口 ──► 服务端与数据库 ──► 管家 Web 控制台
                                      │
                                      ▼
                                人工播放、复核、处置
```

- **边缘端**：树莓派音频采集、YAMNet 推理、网络恢复后的报警上报。
- **服务端**：接收报警、保存事件与音频文件、提供实时推送接口。
- **管家端**：管理老人档案、查看报警、人工确认或标记误报、查看统计。

## 功能

- 本地运行 YAMNet 进行声音事件分类，并为风险预测提供辅助特征。
- 报警音频片段上传与实时 WebSocket 推送。
- 管家端报警列表、音频回放和人工复核。
- 老人档案、紧急联系人、风险事件和趋势统计管理。
- 树莓派安装、诊断与模型验证脚本。

## 快速开始

### 云端应用

前置条件：Node.js 20+、pnpm 10+、可用的 MySQL 数据库。

```bash
git clone git@github.com:mahui1982320-svg/elderly_safety_monitor.git
cd elderly_safety_monitor
pnpm install
pnpm db:push
pnpm dev
```

运行前请按实际部署环境配置数据库、对象存储、认证与公网回调地址。不要把生产密钥、数据库密码或真实音频数据提交到仓库。

### 树莓派边缘端

前置条件：树莓派 4B（或兼容设备）、ReSpeaker 麦克风阵列、Python 3 与稳定网络。

```bash
git clone git@github.com:mahui1982320-svg/elderly_safety_monitor.git
cd elderly_safety_monitor
bash raspberry_pi_setup.sh
bash install_yamnet_auto.sh
python3 raspberry_pi_yamnet.py
```

开始采集前，先在边缘端配置服务端地址、设备/老人标识和阈值，并按真实硬件环境完成麦克风测试。

## 文档导航

- [系统快速使用](QUICKSTART.md)
- [硬件集成](HARDWARE_INTEGRATION.md)
- [树莓派与云端集成](RASPBERRY_PI_CLOUD_INTEGRATION.md)
- [YAMNet 安装与验证](RASPBERRY_PI_YAMNET_INSTALLATION.md)
- [接口说明](API_DOCUMENTATION.md)
- [故障排查](TROUBLESHOOTING_FAQ.md)

部分历史文档保留了演示地址、示例账号或阶段性指标，仅用于说明思路；请以本 README、实际代码与部署环境为准。

## 项目结构

```text
client/                    管家端 Web 界面
server/                    服务端与 API
shared/                    共享数据模型
raspberry_pi_*.py          边缘端采集、上报与 YAMNet 推理
*.sh                       树莓派安装、诊断和验证脚本
assets/                    项目公开展示资源
```

## 数据与隐私

- 音频片段及老人档案属于敏感数据，应使用 HTTPS、访问控制、最小化留存和审计记录。
- 部署前应明确告知与取得必要授权，并遵守适用的数据保护和养老服务规范。
- 建议仅上传报警所需的最短音频片段，并设置可执行的数据删除策略。

## 开源许可

本仓库以 [MIT License](LICENSE) 发布。
