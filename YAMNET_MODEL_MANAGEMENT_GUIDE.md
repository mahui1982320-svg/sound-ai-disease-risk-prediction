# YAMNet模型版本管理与对比功能集成指南

## 概述

本文档说明如何在小羊养老声音监控系统中使用YAMNet模型版本管理与对比功能，支持：

- 管理多个YAMNet模型版本
- 在不同模型之间切换
- 对比分析不同模型的性能差异
- 追踪模型性能指标

## 核心功能

### 1. 模型版本管理

#### 数据库表结构

**yamnet_models** - 模型版本表
```
- id: 模型ID
- version: 版本号 (如 v1.0, v1.1, v2.0)
- name: 模型名称
- description: 模型描述
- modelPath: 模型文件路径
- checksumHash: 模型校验和
- avgProcessingTime: 平均推理时间 (ms)
- avgAccuracy: 平均准确度 (%)
- supportedLabels: 支持的标签数量 (默认521)
- isActive: 是否为活跃模型
- isDefault: 是否为默认模型
- releaseNotes: 发布说明
- deprecatedAt: 弃用时间
```

**yamnet_model_comparisons** - 模型对比表
```
- id: 对比记录ID
- alarmRecordId: 报警记录ID
- baselineModelId: 基准模型ID
- compareModelId: 对比模型ID
- baselineEventType: 基准模型识别的事件类型
- baselineConfidence: 基准模型的置信度
- compareEventType: 对比模型识别的事件类型
- compareConfidence: 对比模型的置信度
- confidenceDiff: 置信度差异
- processingTimeDiff: 推理时间差异
- isConsistent: 两个模型结果是否一致
```

**yamnet_model_stats** - 模型统计表
```
- id: 统计记录ID
- modelId: 模型ID
- totalInferences: 总推理次数
- avgProcessingTime: 平均推理时间
- avgConfidence: 平均置信度
- fallCount/screamCount/coughCount/moanCount: 事件类型统计
- highConfidenceCount/mediumConfidenceCount/lowConfidenceCount: 置信度分布
- periodStart/periodEnd: 统计周期
```

### 2. 后端API接口

#### 模型管理接口

```typescript
// 获取所有模型
trpc.yamnetModels.listModels.useQuery()

// 获取活跃模型
trpc.yamnetModels.getActiveModel.useQuery()

// 获取默认模型
trpc.yamnetModels.getDefaultModel.useQuery()

// 获取指定版本的模型
trpc.yamnetModels.getModelByVersion.useQuery({ version: "v1.0" })

// 创建新模型版本
trpc.yamnetModels.createModel.useMutation({
  version: "v2.0",
  name: "YAMNet Optimized v2",
  modelPath: "/models/yamnet_v2.0.tflite",
  avgProcessingTime: 120,
  avgAccuracy: 92,
})

// 激活模型
trpc.yamnetModels.activateModel.useMutation({ id: 1 })

// 设置默认模型
trpc.yamnetModels.setDefaultModel.useMutation({ id: 1 })

// 弃用模型
trpc.yamnetModels.deprecateModel.useMutation({ id: 1 })
```

#### 对比分析接口

```typescript
// 获取指定报警的模型对比结果
trpc.yamnetModels.getModelComparisons.useQuery({ alarmId: 123 })

// 获取两个模型的对比统计
trpc.yamnetModels.getComparisonStats.useQuery({
  baselineModelId: 1,
  compareModelId: 2,
  startDate: new Date("2026-01-01"),
  endDate: new Date("2026-01-31"),
})

// 获取模型的统计数据
trpc.yamnetModels.getModelStats.useQuery({ modelId: 1 })
```

### 3. 前端组件

#### YAMNetModelManager 组件

**位置**: `client/src/components/YAMNetModelManager.tsx`

**功能**:
- 列出所有模型版本
- 显示活跃模型和默认模型
- 激活/设置默认/弃用模型
- 查看模型详情

**使用示例**:
```tsx
import { YAMNetModelManager } from "@/components/YAMNetModelManager";

export function ModelManagementPage() {
  return (
    <div className="p-6">
      <YAMNetModelManager />
    </div>
  );
}
```

#### YAMNetModelComparison 组件

**位置**: `client/src/components/YAMNetModelComparison.tsx`

**功能**:
- 选择两个模型进行对比
- 指定时间范围
- 显示对比统计（一致性、置信度差异、推理时间差异）
- 提供对比分析建议

**使用示例**:
```tsx
import { YAMNetModelComparison } from "@/components/YAMNetModelComparison";

export function ModelComparisonPage() {
  return (
    <div className="p-6">
      <YAMNetModelComparison />
    </div>
  );
}
```

## 集成步骤

### 1. 在管家端仪表板中添加模型管理页面

```tsx
// client/src/pages/ModelManagement.tsx
import { YAMNetModelManager } from "@/components/YAMNetModelManager";

export function ModelManagementPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">YAMNet模型管理</h1>
        <p className="text-gray-600">管理和切换不同版本的YAMNet模型</p>
      </div>
      <YAMNetModelManager />
    </div>
  );
}
```

### 2. 在App.tsx中注册路由

```tsx
import { ModelManagementPage } from "@/pages/ModelManagement";
import { ModelComparisonPage } from "@/pages/ModelComparison";

export function App() {
  return (
    <Router>
      <Route path="/models" component={ModelManagementPage} />
      <Route path="/models/compare" component={ModelComparisonPage} />
    </Router>
  );
}
```

### 3. 在导航菜单中添加链接

```tsx
// client/src/components/DashboardLayout.tsx
<nav>
  <Link to="/models">模型管理</Link>
  <Link to="/models/compare">模型对比</Link>
</nav>
```

## 工作流程

### 场景1: 升级模型版本

1. 在模型管理页面中查看所有可用模型
2. 选择新的模型版本
3. 点击"激活此模型"按钮
4. 系统自动停用旧模型，启用新模型
5. 新的推理请求将使用新模型

### 场景2: 对比两个模型的性能

1. 进入模型对比页面
2. 选择基准模型（通常是当前使用的模型）
3. 选择对比模型（新的或备选模型）
4. 指定对比时间范围（可选）
5. 点击"开始对比"按钮
6. 查看对比结果：
   - 结果一致性（两个模型识别结果是否相同）
   - 置信度差异（平均置信度差异）
   - 推理时间差异（平均推理时间差异）
7. 根据对比分析建议决定是否切换模型

### 场景3: 弃用旧模型

1. 在模型管理页面中找到要弃用的模型
2. 点击"弃用此模型"按钮
3. 系统将模型标记为已弃用
4. 已弃用的模型不会被自动选中，但数据仍保留用于历史查询

## 性能指标说明

### 置信度差异 (Confidence Difference)

表示两个模型对同一音频的识别置信度差异。

- **< 5%**: 两个模型性能相近，可以放心切换
- **5-10%**: 模型性能有轻微差异
- **> 10%**: 模型性能差异较大，需要谨慎评估

### 推理时间差异 (Processing Time Difference)

表示两个模型的推理速度差异。

- **< 50ms**: 推理速度相近
- **50-100ms**: 推理速度有明显差异
- **> 100ms**: 推理速度差异很大，可能影响实时性

### 结果一致性 (Consistency)

表示两个模型对同一音频的识别结果是否相同。

- **> 80%**: 高度一致，可以放心切换
- **60-80%**: 一致性较好，大多数情况相同
- **< 60%**: 一致性较差，需要谨慎评估

## 最佳实践

1. **定期对比**: 在升级模型前，使用对比功能验证新模型的性能
2. **保留历史数据**: 不要删除旧模型的统计数据，用于长期性能追踪
3. **监控性能**: 定期查看模型统计数据，识别性能下降的趋势
4. **渐进式升级**: 先在小范围内测试新模型，验证后再全量推出
5. **记录发布说明**: 为每个模型版本记录发布说明，便于后续查阅

## 故障排除

### 问题1: 模型切换后识别准确度下降

**原因**: 新模型可能对特定场景的识别能力较差

**解决方案**:
1. 使用对比功能分析新旧模型的差异
2. 查看新模型在特定事件类型上的表现
3. 如果差异较大，考虑回滚到旧模型
4. 收集更多数据进行模型微调

### 问题2: 新模型推理时间过长

**原因**: 新模型可能更复杂，需要更多计算资源

**解决方案**:
1. 检查推理时间差异指标
2. 评估硬件性能是否满足需求
3. 考虑使用量化或压缩版本的模型
4. 优化推理管道（如批处理）

### 问题3: 对比数据不足

**原因**: 新模型使用时间短，对比数据不够

**解决方案**:
1. 等待更多推理数据积累
2. 扩大时间范围进行对比
3. 手动创建对比记录进行测试

## 后续改进

1. **自动模型选择**: 根据音频特征自动选择最适合的模型
2. **A/B测试**: 支持在两个模型之间进行A/B测试
3. **模型融合**: 支持多个模型的融合推理
4. **性能预测**: 基于历史数据预测模型升级的影响
5. **自动回滚**: 检测到性能下降时自动回滚到旧模型

## 相关文档

- [YAMNet集成计划](./YAMNET_INTEGRATION_PLAN.md)
- [YAMNet实现指南](./YAMNET_IMPLEMENTATION_GUIDE.md)
- [YAMNet推理详情展示组件集成指南](./YAMNET_UI_INTEGRATION_GUIDE.md)
