import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Zap, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface ComparisonStats {
  totalComparisons: number;
  consistentCount: number;
  inconsistentCount: number;
  avgConfidenceDiff: number;
  avgProcessingTimeDiff: number;
}

export function YAMNetModelComparison() {
  const [baselineModelId, setBaselineModelId] = useState<number | null>(null);
  const [compareModelId, setCompareModelId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  // 获取所有模型
  const { data: models, isLoading: modelsLoading } = trpc.yamnetModels.listModels.useQuery();

  // 获取对比统计
  const { data: stats, isLoading: statsLoading, refetch } = trpc.yamnetModels.getComparisonStats.useQuery(
    {
      baselineModelId: baselineModelId || 0,
      compareModelId: compareModelId || 0,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
    { enabled: !!baselineModelId && !!compareModelId }
  );

  const baselineModel = models?.find((m) => m.id === baselineModelId);
  const compareModel = models?.find((m) => m.id === compareModelId);

  const handleCompare = () => {
    if (baselineModelId && compareModelId) {
      refetch();
    }
  };

  const consistencyData = stats
    ? [
        { name: "一致", value: stats.consistentCount, fill: "#10b981" },
        { name: "不一致", value: stats.inconsistentCount, fill: "#ef4444" },
      ]
    : [];

  const performanceData = stats
    ? [
        {
          metric: "置信度差异",
          value: Math.abs(stats.avgConfidenceDiff),
          baseline: baselineModel?.name || "基准模型",
          compare: compareModel?.name || "对比模型",
        },
        {
          metric: "推理时间差异",
          value: Math.abs(stats.avgProcessingTimeDiff),
          baseline: baselineModel?.name || "基准模型",
          compare: compareModel?.name || "对比模型",
        },
      ]
    : [];

  if (modelsLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>YAMNet模型对比分析</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40">
            <div className="text-gray-500">加载中...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!models || models.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>YAMNet模型对比分析</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500">需要至少2个模型版本进行对比</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 对比配置 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            模型对比配置
          </CardTitle>
          <CardDescription>选择两个模型版本进行性能对比分析</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 基准模型选择 */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">基准模型</label>
              <Select value={baselineModelId?.toString() || ""} onValueChange={(val) => setBaselineModelId(Number(val))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择基准模型" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id.toString()}>
                      {model.version} - {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 对比模型选择 */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">对比模型</label>
              <Select value={compareModelId?.toString() || ""} onValueChange={(val) => setCompareModelId(Number(val))}>
                <SelectTrigger>
                  <SelectValue placeholder="选择对比模型" />
                </SelectTrigger>
                <SelectContent>
                  {models
                    .filter((m) => m.id !== baselineModelId)
                    .map((model) => (
                      <SelectItem key={model.id} value={model.id.toString()}>
                        {model.version} - {model.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 时间范围选择 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">开始日期</label>
              <input
                type="date"
                value={startDate ? startDate.toISOString().split("T")[0] : ""}
                onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">结束日期</label>
              <input
                type="date"
                value={endDate ? endDate.toISOString().split("T")[0] : ""}
                onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>

          {/* 对比按钮 */}
          <Button
            onClick={handleCompare}
            disabled={!baselineModelId || !compareModelId || statsLoading}
            className="w-full"
          >
            {statsLoading ? "分析中..." : "开始对比"}
          </Button>
        </CardContent>
      </Card>

      {/* 对比结果 */}
      {stats && (
        <>
          {/* 统计摘要 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">总对比次数</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{stats.totalComparisons}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  结果一致
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{stats.consistentCount}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.totalComparisons > 0
                    ? ((stats.consistentCount / stats.totalComparisons) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  结果不一致
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{stats.inconsistentCount}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.totalComparisons > 0
                    ? ((stats.inconsistentCount / stats.totalComparisons) * 100).toFixed(1)
                    : 0}
                  %
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  平均差异
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">
                  置信度: <span className="font-bold">{stats.avgConfidenceDiff}%</span>
                </p>
                <p className="text-sm">
                  推理时间: <span className="font-bold">{stats.avgProcessingTimeDiff}ms</span>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 一致性饼图 */}
          {stats.totalComparisons > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>结果一致性分布</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={consistencyData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(1)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {consistencyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 性能差异对比 */}
          <Card>
            <CardHeader>
              <CardTitle>性能指标对比</CardTitle>
              <CardDescription>
                {baselineModel?.name} vs {compareModel?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* 置信度差异 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">置信度差异</span>
                    <Badge
                      variant={Math.abs(stats.avgConfidenceDiff) < 5 ? "default" : "destructive"}
                    >
                      {stats.avgConfidenceDiff > 0 ? "+" : ""}{stats.avgConfidenceDiff}%
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={cn(
                        "h-2 rounded-full",
                        Math.abs(stats.avgConfidenceDiff) < 5 ? "bg-green-500" : "bg-red-500"
                      )}
                      style={{ width: `${Math.min(Math.abs(stats.avgConfidenceDiff) * 5, 100)}%` }}
                    />
                  </div>
                </div>

                {/* 推理时间差异 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">推理时间差异</span>
                    <Badge
                      variant={Math.abs(stats.avgProcessingTimeDiff) < 50 ? "default" : "destructive"}
                    >
                      {stats.avgProcessingTimeDiff > 0 ? "+" : ""}{stats.avgProcessingTimeDiff}ms
                    </Badge>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={cn(
                        "h-2 rounded-full",
                        Math.abs(stats.avgProcessingTimeDiff) < 50 ? "bg-green-500" : "bg-yellow-500"
                      )}
                      style={{ width: `${Math.min(Math.abs(stats.avgProcessingTimeDiff) / 2, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 对比建议 */}
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">对比分析建议</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  {stats.consistentCount / stats.totalComparisons > 0.8 ? (
                    <li>✓ 两个模型的识别结果高度一致，可以放心切换</li>
                  ) : (
                    <li>⚠ 两个模型的识别结果存在差异，建议谨慎切换</li>
                  )}
                  {Math.abs(stats.avgConfidenceDiff) < 5 ? (
                    <li>✓ 置信度差异较小，模型性能相近</li>
                  ) : (
                    <li>⚠ 置信度差异较大，{stats.avgConfidenceDiff > 0 ? "对比模型" : "基准模型"}更准确</li>
                  )}
                  {Math.abs(stats.avgProcessingTimeDiff) < 50 ? (
                    <li>✓ 推理时间差异较小，性能相近</li>
                  ) : (
                    <li>⚠ 推理时间差异较大，{stats.avgProcessingTimeDiff > 0 ? "基准模型" : "对比模型"}更快</li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
