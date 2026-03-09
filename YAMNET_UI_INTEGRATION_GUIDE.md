# YAMNet推理详情展示组件集成指南

## 概述

本文档说明如何在管家端仪表板中集成YAMNet推理详情展示组件，用于实时显示和分析音频事件识别结果。

## 新增组件

### 1. YAMNetInferencePanel 组件

**位置**: `client/src/components/YAMNetInferencePanel.tsx`

**功能**: 展示YAMNet模型的推理详情，包括：
- 识别事件类型和置信度
- 顶部标签分析（521个音频事件分类）
- 性能指标（推理时间、音频长度、模型版本）
- 性能评估和建议

**Props**:
```typescript
interface YAMNetInferencePanelProps {
  data: YAMNetInferenceDetails | null;
  isLoading?: boolean;
}

interface YAMNetInferenceDetails {
  topLabels: YAMNetLabel[];
  mappedEventType: "fall" | "scream" | "cough" | "moan" | null;
  mappingConfidence: number | null;
  processingTime: number | null;
  audioLength: number | null;
  modelVersion: string | null;
}
```

**使用示例**:
```tsx
import { YAMNetInferencePanel } from "@/components/YAMNetInferencePanel";

export function AlarmDetails() {
  const { data: yamnetDetails, isLoading } = trpc.alarms.getYAMNetDetails.useQuery({
    alarmId: alarmId,
  });

  return (
    <YAMNetInferencePanel
      data={yamnetDetails || null}
      isLoading={isLoading}
    />
  );
}
```

### 2. YAMNetStatsDashboard 组件

**位置**: `client/src/components/YAMNetStatsDashboard.tsx`

**功能**: 展示YAMNet推理统计信息，包括：
- 总推理次数
- 平均推理时间
- 平均音频长度
- 模型版本列表
- 推理时间趋势图
- 音频长度分布图
- 性能评分

**Props**:
```typescript
interface YAMNetStatsDashboardProps {
  stats: YAMNetStats | null;
  isLoading?: boolean;
}

interface YAMNetStats {
  totalInferences: number;
  avgProcessingTime: number;
  avgAudioLength: number;
  modelVersions: string[];
}
```

**使用示例**:
```tsx
import { YAMNetStatsDashboard } from "@/components/YAMNetStatsDashboard";

export function StatsDashboard() {
  const { data: stats, isLoading } = trpc.alarms.getYAMNetStats.useQuery();

  return (
    <YAMNetStatsDashboard
      stats={stats || null}
      isLoading={isLoading}
    />
  );
}
```

### 3. AlarmDetailModalWithYAMNet 组件

**位置**: `client/src/components/AlarmDetailModalWithYAMNet.tsx`

**功能**: 增强的报警详情模态框，集成YAMNet推理分析，包括：
- 概览标签页：老人信息、报警信息、音频播放
- YAMNet分析标签页：推理详情、顶部标签、性能评估
- 复核标签页：复核备注、复核建议

**Props**:
```typescript
interface AlarmDetailModalWithYAMNetProps {
  alarm: AlarmRecord;
  elderly?: Elderly | null;
  isOpen: boolean;
  onClose: () => void;
  onReviewSuccess?: () => void;
}
```

**使用示例**:
```tsx
import { AlarmDetailModalWithYAMNet } from "@/components/AlarmDetailModalWithYAMNet";

export function AlarmList() {
  const [selectedAlarm, setSelectedAlarm] = useState<AlarmRecord | null>(null);

  return (
    <>
      <AlarmDetailModalWithYAMNet
        alarm={selectedAlarm!}
        elderly={elderlyData}
        isOpen={!!selectedAlarm}
        onClose={() => setSelectedAlarm(null)}
      />
    </>
  );
}
```

## 后端API接口

### 获取YAMNet推理详情

**端点**: `trpc.alarms.getYAMNetDetails`

**参数**:
```typescript
{
  alarmId: string;
}
```

**返回值**:
```typescript
{
  topLabels: Array<{
    label: string;
    confidence: number;
  }>;
  mappedEventType: "fall" | "scream" | "cough" | "moan" | null;
  mappingConfidence: number | null;
  processingTime: number | null;
  audioLength: number | null;
  modelVersion: string | null;
}
```

### 获取YAMNet推理统计

**端点**: `trpc.alarms.getYAMNetStats`

**参数**: 无

**返回值**:
```typescript
{
  totalInferences: number;
  avgProcessingTime: number;
  avgAudioLength: number;
  modelVersions: string[];
}
```

## 集成步骤

### 1. 在现有AlarmDetailModal中添加YAMNet标签页

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YAMNetInferencePanel } from "@/components/YAMNetInferencePanel";
import { Brain } from "lucide-react";

export function AlarmDetailModal({ alarm, ... }: AlarmDetailModalProps) {
  const { data: yamnetDetails, isLoading } = trpc.alarms.getYAMNetDetails.useQuery(
    { alarmId: alarm.id },
    { enabled: isOpen }
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="yamnet" className="flex items-center gap-2">
              <Brain size={16} />
              YAMNet分析
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            {/* 现有内容 */}
          </TabsContent>

          <TabsContent value="yamnet">
            <YAMNetInferencePanel
              data={yamnetDetails || null}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
```

### 2. 在仪表板中添加YAMNet统计

```tsx
import { YAMNetStatsDashboard } from "@/components/YAMNetStatsDashboard";

export function DashboardPage() {
  const { data: stats, isLoading } = trpc.alarms.getYAMNetStats.useQuery();

  return (
    <div className="space-y-6">
      {/* 其他仪表板内容 */}
      <YAMNetStatsDashboard stats={stats || null} isLoading={isLoading} />
    </div>
  );
}
```

## 样式和主题

所有组件使用shadcn/ui组件库和Tailwind CSS，支持深色/浅色主题切换。

### 颜色方案

- **高置信度** (≥80%): 绿色 (`text-green-600`)
- **中置信度** (60-80%): 黄色 (`text-yellow-600`)
- **低置信度** (<60%): 红色 (`text-red-600`)

### 响应式设计

所有组件都支持响应式设计，在移动设备上自动调整布局。

## 测试

### 运行单元测试

```bash
pnpm test client/src/components/YAMNetInferencePanel.test.tsx
```

### 测试覆盖范围

- 加载状态渲染
- 空状态渲染
- 推理详情展示
- 顶部标签显示
- 性能指标展示
- 置信度颜色显示
- Null值处理
- 建议推荐逻辑
- 警告消息显示

## 性能优化

### 1. 查询缓存

使用tRPC的查询缓存避免重复请求：

```tsx
const { data, isLoading } = trpc.alarms.getYAMNetDetails.useQuery(
  { alarmId },
  {
    staleTime: 5 * 60 * 1000, // 5分钟缓存
    gcTime: 10 * 60 * 1000,   // 10分钟垃圾回收
  }
);
```

### 2. 懒加载

只在需要时加载YAMNet详情：

```tsx
const { data, isLoading } = trpc.alarms.getYAMNetDetails.useQuery(
  { alarmId },
  { enabled: isOpen } // 仅在模态框打开时加载
);
```

### 3. 图表优化

使用Recharts的ResponsiveContainer实现高效的图表渲染。

## 故障排除

### 问题1: YAMNet数据为null

**原因**: 推理结果未保存到数据库

**解决方案**: 检查服务器端的`createYAMNetInference`函数是否正确调用

### 问题2: 推理时间过长

**原因**: 硬件性能不足或模型版本过旧

**解决方案**: 
1. 检查`processingTime`指标
2. 考虑升级硬件或优化模型
3. 查看`YAMNetStatsDashboard`中的性能评分

### 问题3: 置信度始终很低

**原因**: 音频采集质量差或标签映射不准确

**解决方案**:
1. 检查音频采集设备
2. 调整`mapYAMNetLabelToEventType`函数中的置信度阈值
3. 收集更多训练数据进行微调

## 最佳实践

1. **始终检查null值**: YAMNet数据可能为null，使用可选链操作符
2. **提供加载状态**: 使用`isLoading`属性显示加载动画
3. **处理错误**: 在tRPC查询中添加错误处理
4. **优化查询**: 使用`enabled`条件避免不必要的请求
5. **监控性能**: 定期检查`YAMNetStatsDashboard`中的性能指标

## 后续改进

1. **实时更新**: 使用WebSocket实现实时推理结果推送
2. **高级过滤**: 按事件类型、置信度、时间范围过滤推理结果
3. **导出报告**: 支持导出YAMNet推理统计报告
4. **模型管理**: 支持切换不同版本的YAMNet模型
5. **自定义阈值**: 允许用户自定义置信度阈值和标签映射
