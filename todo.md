# 养老院智能报警管理系统 - 项目待办

## 数据库与后端
- [x] 设计数据库表结构（老人档案、报警记录、复核日志）
- [x] 实现老人档案管理API（CRUD）
- [x] 实现报警数据接收API（硬件端上传）
- [x] 实现报警列表查询API（分页、筛选）
- [x] 实现报警复核API（确认/误报）
- [x] 实现数据统计API（趋势、误报率、事件分布）
- [x] 编写后端单元测试（vitest）

## 前端UI与交互
- [x] 设计全局样式与配色方案（优雅精致风格）
- [x] 创建DashboardLayout布局框架
- [x] 实现导航菜单与路由
- [x] 开发报警列表页面（展示、排序、筛选）
- [x] 开发音频播放组件（播放/暂停/进度条）
- [x] 开发人工复核界面（确认/误报按钮）
- [x] 开发老人档案管理页面（CRUD）
- [x] 开发数据统计面板（图表展示）

## 功能集成
- [x] 集成实时通知推送（新报警时推送）
- [x] 实现音频播放功能
- [x] 实现复核状态管理
- [x] 实现数据筛选与搜索

## 测试与部署
- [x] 功能测试（所有API和UI流程）
- [x] 性能优化
- [x] 创建首个检查点
- [x] 部署到生产环境

## 文档与交付
- [x] 编写API文文档（API_DOCUMENTATION.md）
- [x] 编写硬件集成指南（HARDWARE_INTEGRATION.md）
- [x] 编写快速开始指南（QUICKSTART.md）

## 设计决策
- 视觉风格：优雅、精致、完美，体现专业性和可靠性
- 主题：浅色主题，采用柔和的蓝灰色和绿色作为主色调
- 字体：使用优雅的中文字体和现代无衬线英文字体
- 布局：侧边栏导航 + 主内容区，响应式设计适配移动设备


## 功能完善与增强
- [x] 扩展数据库模型（添加老人详细信息：地址、身体情况、护理员等）
- [x] 创建种子数据脚本（虫拟用户和报警数据）
- [x] 增强报警界面（显示老人详细信息）
- [x] 后端 API 整合 YAMNet 模型处理逻辑
- [x] 创建真实报警音频片段（模拟摸倒、尖叫等）
- [x] 编写新功能的单元测试（21个测试全部通过）


## 问题修复与功能完善
- [x] 修复老人信息显示为"未知老人"的问题
- [ ] 完善 YAMNet 模型集成（后端音频分析处理）
- [ ] 添加真实音频文件支持

## YAMNet 模型集成
- [x] 后端 API 整合 YAMNet 模型分析逻辑（yamnet.ts）
- [x] 创建音频文件处理接口
- [x] 实现模型推理和事件识别
- [x] 前端上传音频文件功能
- [x] 树莓派端 Python 实现（raspberry_pi_yamnet.py）
- [x] 编写 YAMNet 集成完整指南（YAMNET_INTEGRATION_COMPLETE.md）


## 硬件部分文档（面向非技术人员）
- [x] 创建详细的硬件采购清单（HARDWARE_PROCUREMENT_GUIDE.md）
- [x] 创建组装和调试视频指南（ASSEMBLY_AND_DEBUGGING_VIDEO_GUIDE.md）
- [x] 创建快速参考卡（QUICK_REFERENCE_CARD.md）
- [x] 创建常见问题解决指南（TROUBLESHOOTING_FAQ.md）
- [x] 所有硬件文档完成

## 树莓派与云端系统对接集成
- [x] 扩展数据库schema：新增devices设备管理表和pi_events树莓派事件上传表
- [x] 扩展事件类型枚举：支持YAMNet的21种危险事件类型
- [x] 完善raspberryPi路由：实现真正的事件接收和音频上传API
- [x] 实现设备注册和心跳机制
- [x] 实现音频文件上传到S3存储
- [x] 添加设备监控页面到前端
- [x] 更新树莓派端Python上传脚本
- [x] 编写集成测试（vitest）
- [x] 生成完整的树莓派部署脚本

## Bug修复
- [x] 修复树莓派终端运行Python脚本时中文显示为问号的问题（改为英文输出）
- [x] 修复回滚后raspberryPi路由丢失导致404的问题
- [x] 修复侧边栏导航路由跳转问题（统一DashboardLayout包装）
- [x] 修复根路径匹配问题（path="" 改为 path="/"）
- [x] 注册树莓派设备，获取API Token
- [x] 生成树莓派上报脚本（yamnet_uploader.py）
- [x] 端到端联调验证（demo模式通过，真实硬件待测）
- [x] 修复页面偶发NotFoundError: removeChild DOM错误（ErrorBoundary汉化+3秒自动重载，禁用refetchOnWindowFocus）
- [x] 事件监控页面YAMNet声音类别名称汉化（Speech、Fire、Breathing等英文改中文，包含大部分521类）
- [x] 修复 yamnet_uploader.py：添加 --sample-rate 参数，自动重采样到 16kHz，修复 reSpeaker 持续识别为鲸鱼声的采样率问题

## 音频处理流水线修复（2026-03-20）
- [x] 修复 yamnet_uploader.py：添加 DC 偏移去除步骤（audio = audio - np.mean(audio)），消除 reSpeaker 稀疏采样导致的"鲸鱼叫声"误检
- [x] 修复 yamnet_uploader.py：添加归一化到 ±1.0（audio / max_amp），确保不同麦克风增益下的一致性
- [x] 修复 yamnet_uploader.py：将 RMS 计算改为 AC RMS（nz.std()），忽略 DC 偏移，更准确地检测静音
- [x] 修复 yamnet_uploader.py：移除过时的 sounddevice 依赖检查（现在使用 ALSA arecord）
- [x] 修复 yamnet_uploader.py：修复 raw_rms 变量作用域问题（demo 模式下未初始化）
- [x] 更新 record_audio_arecord 函数文档，记录完整的 7 步音频处理流水线

## 树莓派端脚本更新部署
- [x] 将修复后的 yamnet_uploader.py 上传到可下载位置
- [x] 生成树莓派端一键更新命令
- [x] 提供验证步骤确认 DC 偏移修复生效

## 系统状态快照与开机自动恢复保障
- [x] 检查云端 Web 项目状态
- [x] 检查树莓派端 yamnet_uploader.py 最终版本
- [x] 检查 systemd 服务配置
- [x] 编写完整的系统状态快照文档（SYSTEM_STATE_SNAPSHOT.md）
- [x] 确保开机后自动恢复正常运行

## 四项优化（2026-03-20）
- [x] systemd 开机 MD5 自检：ExecStartPre 校验脚本完整性
- [x] 云端设备离线告警：树莓派超过 2 分钟无心跳时发送通知
- [x] 网页系统健康面板：展示 CPU 温度、在线时长、推理速度等
- [x] 网页端实时滚动监控画面：非技术人员可直观看到实时推理状态

## 归一化放大底噪修复（2026-03-21）
- [x] 诊断 Whale vocalization 91.8% 再次出现的根因：归一化将微弱底噪放大80倍
- [x] 修复：归一化阈值从 1e-7 改为 0.1，弱信号保持原始幅度
- [x] 上传修复后脚本到 CDN
