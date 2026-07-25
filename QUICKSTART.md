# 快速开始

本指南用于在开发或测试环境启动“声音 AI＋疾病与风险预测”。生产部署前请完成安全评估、数据保护配置和硬件实测。

## 1. 启动云端应用

前置条件：Node.js 20+、pnpm 10+、MySQL。

```bash
git clone git@github.com:mahui1982320-svg/elderly_safety_monitor.git
cd elderly_safety_monitor
pnpm install
pnpm db:push
pnpm dev
```

在运行前配置实际使用的数据库、对象存储、认证和公网回调地址。不要使用示例值直接部署到公网，也不要将密钥提交到 Git。

## 2. 配置树莓派边缘端

前置条件：树莓派 4B（或兼容设备）、ReSpeaker 麦克风阵列、Python 3、稳定网络。

```bash
git clone git@github.com:mahui1982320-svg/elderly_safety_monitor.git
cd elderly_safety_monitor
bash raspberry_pi_setup.sh
bash install_yamnet_auto.sh
python3 raspberry_pi_yamnet.py
```

在启动采集前，按实际环境设置：

- 服务端 HTTPS 地址；
- 设备和老人档案标识；
- 音频上传策略与留存期限；
- YAMNet 分类阈值和报警规则。

## 3. 验证流程

1. 使用 `arecord -l` 确认系统已识别麦克风设备。
2. 按 [YAMNet 安装与验证](RASPBERRY_PI_YAMNET_INSTALLATION.md) 完成本地模型验证。
3. 进行受控声音测试，检查报警事件能否上报到管家端。
4. 在管家端人工播放报警片段，并完成“确认危险”或“标记误报”的复核。

## 4. 上线前检查

- 使用 HTTPS 和受限的服务端访问控制。
- 以最短必要时长保存报警音频，并验证删除策略。
- 为报警处置设置人工值守和紧急联系人流程。
- 在真实环境中评估误报、漏报和网络中断恢复策略。

更多硬件和接口资料请从 [README](README.md) 的文档导航进入。
