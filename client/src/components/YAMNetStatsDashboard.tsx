import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Activity, TrendingUp, Zap, Database } from "lucide-react";

interface YAMNetStats {
  totalInferences: number;
  avgProcessingTime: number;
  avgAudioLength: number;
  modelVersions: string[];
}

interface YAMNetStatsDashboardProps {
  stats: YAMNetStats | null;
  isLoading?: boolean;
}

// 模拟历史数据
const processingTimeHistory = [
  { time: "00:00", avgTime: 145, minTime: 120, maxTime: 180 },
  { time: "04:00", avgTime: 148, minTime: 125, maxTime: 185 },
  { time: "08:00", avgTime: 150, minTime: 130, maxTime: 190 },
  { time: "12:00", avgTime: 155, minTime: 135, maxTime: 200 },
  { time: "16:00", avgTime: 152, minTime: 128, maxTime: 195 },
  { time: "20:00", avgTime: 149, minTime: 122, maxTime: 188 },
  { time: "24:00", avgTime: 147, minTime: 125, maxTime: 185 },
];

const audioLengthDistribution = [
  { range: "500-1000ms", count: 120, percentage: 15 },
  { range: "1000-1500ms", count: 380, percentage: 48 },
  { range: "1500-2000ms", count: 220, percentage: 28 },
  { range: "2000+ms", count: 80, percentage: 10 },
];

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

export function YAMNetStatsDashboard({
  stats,
  isLoading = false,
}: YAMNetStatsDashboardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity size={20} />
            YAMNet推理统计
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity size={20} />
            YAMNet推理统计
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-gray-500">
            <p>暂无统计数据</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 关键指标卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Database size={16} className="text-blue-600" />
              总推理次数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.totalInferences}</div>
            <p className="text-xs text-gray-500 mt-1">自系统启动</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Zap size={16} className="text-yellow-600" />
              平均推理时间
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.avgProcessingTime}ms</div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.avgProcessingTime < 200 ? "✓ 优秀" : "需优化"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingUp size={16} className="text-green-600" />
              平均音频长度
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{stats.avgAudioLength}ms</div>
            <p className="text-xs text-gray-500 mt-1">采集时长</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Activity size={16} className="text-purple-600" />
              模型版本
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {stats.modelVersions.map((version) => (
                <Badge key={version} variant="secondary" className="text-xs">
                  {version}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {stats.modelVersions.length} 个版本
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 推理时间趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>推理时间趋势分析</CardTitle>
          <CardDescription>过去24小时的推理耗时变化</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={processingTimeHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis label={{ value: "时间 (ms)", angle: -90, position: "insideLeft" }} />
              <Tooltip
                formatter={(value) => `${value}ms`}
                labelFormatter={(label) => `时间: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="avgTime"
                stroke="#3b82f6"
                name="平均耗时"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="minTime"
                stroke="#10b981"
                name="最小耗时"
                strokeWidth={1}
                strokeDasharray="5 5"
              />
              <Line
                type="monotone"
                dataKey="maxTime"
                stroke="#ef4444"
                name="最大耗时"
                strokeWidth={1}
                strokeDasharray="5 5"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 音频长度分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>音频长度分布</CardTitle>
            <CardDescription>采集音频的长度分布情况</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={audioLengthDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ range, percentage }) => `${range} ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {audioLengthDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `${value} 次`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 性能指标 */}
        <Card>
          <CardHeader>
            <CardTitle>性能指标</CardTitle>
            <CardDescription>系统推理性能总体评估</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">推理速度评分</span>
                <span className="text-lg font-bold text-green-600">
                  {stats.avgProcessingTime < 200 ? "A+" : stats.avgProcessingTime < 300 ? "A" : "B"}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full"
                  style={{
                    width: `${Math.max(0, 100 - (stats.avgProcessingTime - 100) / 2)}%`,
                  }}
                ></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">系统稳定性</span>
                <span className="text-lg font-bold text-blue-600">95%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: "95%" }}></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">数据完整性</span>
                <span className="text-lg font-bold text-purple-600">98%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-purple-600 h-2 rounded-full" style={{ width: "98%" }}></div>
              </div>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mt-4">
              <p className="text-sm text-gray-700">
                <span className="font-medium">系统状态：</span>
                <span className="text-green-600 font-medium ml-1">✓ 正常运行</span>
              </p>
              <p className="text-xs text-gray-600 mt-1">
                所有指标均在正常范围内，推理性能良好。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 详细统计表 */}
      <Card>
        <CardHeader>
          <CardTitle>音频长度分布详情</CardTitle>
          <CardDescription>各时长区间的推理次数统计</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={audioLengthDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis label={{ value: "推理次数", angle: -90, position: "insideLeft" }} />
              <Tooltip formatter={(value) => `${value} 次`} />
              <Legend />
              <Bar dataKey="count" fill="#3b82f6" name="推理次数" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
