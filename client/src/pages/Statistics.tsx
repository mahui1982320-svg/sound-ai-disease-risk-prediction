import { useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Activity,
} from "lucide-react";

const COLORS = ["#ef4444", "#f97316", "#3b82f6", "#a855f7"];
const EVENT_TYPES = ["fall", "scream", "cough", "moan"];
const EVENT_LABELS: Record<string, string> = {
  fall: "摔倒",
  scream: "尖叫",
  cough: "咳嗽",
  moan: "呻吟",
};

export default function Statistics() {
  const { data: alarms, isLoading } = trpc.alarms.list.useQuery({
    limit: 1000,
    offset: 0,
  });

  const stats = useMemo(() => {
    if (!alarms) {
      return {
        totalAlarms: 0,
        confirmedAlarms: 0,
        falseAlarmCount: 0,
        falseAlarmRate: 0,
        eventDistribution: [],
        trendData: [],
      };
    }

    const total = alarms.length;
    const confirmed = alarms.filter((a) => a.reviewStatus === "confirmed").length;
    const falseAlarms = alarms.filter((a) => a.reviewStatus === "falseAlarm").length;
    const falseAlarmRate = total > 0 ? ((falseAlarms / total) * 100).toFixed(1) : 0;

    // 事件类型分布
    const eventCounts: Record<string, number> = {};
    EVENT_TYPES.forEach((type) => {
      eventCounts[type] = alarms.filter((a) => a.eventType === type).length;
    });

    const eventDistribution = EVENT_TYPES.map((type) => ({
      name: EVENT_LABELS[type],
      value: eventCounts[type],
    })).filter((item) => item.value > 0);

    // 时间趋势（按天统计）
    const trendMap: Record<string, number> = {};
    alarms.forEach((alarm) => {
      const date = new Date(alarm.createdAt).toLocaleDateString("zh-CN");
      trendMap[date] = (trendMap[date] || 0) + 1;
    });

    const trendData = Object.entries(trendMap)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .slice(-30) // 只显示最近30天
      .map(([date, count]) => ({
        date,
        报警数: count,
      }));

    return {
      totalAlarms: total,
      confirmedAlarms: confirmed,
      falseAlarmCount: falseAlarms,
      falseAlarmRate,
      eventDistribution,
      trendData,
    };
  }, [alarms]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 页面头部 */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">数据统计</h1>
          <p className="text-muted-foreground mt-1">
            查看报警数据的统计分析和趋势
          </p>
        </div>

        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">总报警数</p>
                <p className="text-3xl font-bold text-foreground mt-2">
                  {isLoading ? <Skeleton className="h-8 w-20" /> : stats.totalAlarms}
                </p>
              </div>
              <AlertCircle className="text-primary" size={32} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">已确认</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {isLoading ? <Skeleton className="h-8 w-20" /> : stats.confirmedAlarms}
                </p>
              </div>
              <CheckCircle className="text-green-600" size={32} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">误报数</p>
                <p className="text-3xl font-bold text-orange-600 mt-2">
                  {isLoading ? <Skeleton className="h-8 w-20" /> : stats.falseAlarmCount}
                </p>
              </div>
              <TrendingUp className="text-orange-600" size={32} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">误报率</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {isLoading ? <Skeleton className="h-8 w-20" /> : `${stats.falseAlarmRate}%`}
                </p>
              </div>
              <Activity className="text-blue-600" size={32} />
            </div>
          </Card>
        </div>

        {/* 图表 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* 事件类型分布 */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">事件类型分布</h2>
            {isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : stats.eventDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.eventDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stats.eventDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </Card>

          {/* 复核状态分布 */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">复核状态分布</h2>
            {isLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : stats.totalAlarms > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    {
                      name: "状态",
                      待复核: alarms?.filter((a) => a.reviewStatus === "pending").length || 0,
                      已确认: stats.confirmedAlarms,
                      误报: stats.falseAlarmCount,
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="待复核" fill="#fbbf24" />
                  <Bar dataKey="已确认" fill="#10b981" />
                  <Bar dataKey="误报" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-muted-foreground">
                暂无数据
              </div>
            )}
          </Card>
        </div>

        {/* 报警趋势 */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">报警趋势（最近30天）</h2>
          {isLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : stats.trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="报警数"
                  stroke="#0ea5e9"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              暂无数据
            </div>
          )}
        </Card>
      </div>
    </DashboardLayout>
  );
}
