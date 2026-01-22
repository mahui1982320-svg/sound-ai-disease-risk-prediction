import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from "recharts";
import { trpc } from "@/lib/trpc";

const EVENT_TYPES = ["fall", "scream", "cough", "moan"];
const EVENT_LABELS: Record<string, string> = {
  fall: "摔倒",
  scream: "尖叫",
  cough: "咳嗽",
  moan: "呻吟",
};

const EVENT_COLORS: Record<string, string> = {
  fall: "#ef4444",
  scream: "#f97316",
  cough: "#eab308",
  moan: "#a855f7",
};

export default function Statistics() {
  const { data: alarms, isLoading } = trpc.alarms.list.useQuery({
    limit: 1000,
    offset: 0,
  });

  const stats = {
    total: 0,
    confirmed: 0,
    falseAlarms: 0,
    pending: 0,
    falseAlarmRate: 0,
    eventDistribution: [] as Array<{ name: string; value: number }>,
    reviewStatusDistribution: [] as Array<{ name: string; value: number }>,
    trendData: [] as Array<{ date: string; count: number }>,
  };

  if (alarms && alarms.length > 0) {
    const total = alarms.length;
    const confirmed = alarms.filter((a) => a.alarm.reviewStatus === "confirmed").length;
    const falseAlarms = alarms.filter((a) => a.alarm.reviewStatus === "falseAlarm").length;
    const pending = alarms.filter((a) => a.alarm.reviewStatus === "pending").length;
    const falseAlarmRate = total > 0 ? ((falseAlarms / total) * 100).toFixed(1) : 0;

    // 事件类型分布
    const eventCounts: Record<string, number> = {};
    EVENT_TYPES.forEach((type) => {
      eventCounts[type] = alarms.filter((a) => a.alarm.eventType === type).length;
    });

    const eventDistribution = EVENT_TYPES.map((type) => ({
      name: EVENT_LABELS[type],
      value: eventCounts[type],
    })).filter((item) => item.value > 0);

    // 复核状态分布
    const reviewStatusDistribution = [
      { name: "待复核", value: pending },
      { name: "已确认", value: confirmed },
      { name: "误报", value: falseAlarms },
    ].filter((item) => item.value > 0);

    // 时间趋势（按天统计）
    const trendMap: Record<string, number> = {};
    alarms.forEach((alarm) => {
      const date = new Date(alarm.alarm.createdAt).toLocaleDateString("zh-CN");
      trendMap[date] = (trendMap[date] || 0) + 1;
    });

    const trendData = Object.entries(trendMap)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .slice(-30)
      .map(([date, count]) => ({ date, count }));

    Object.assign(stats, {
      total,
      confirmed,
      falseAlarms,
      pending,
      falseAlarmRate,
      eventDistribution,
      reviewStatusDistribution,
      trendData,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-4 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">数据统计</h1>
        <p className="text-sm text-gray-600">报警趋势分析和系统性能评估</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="text-sm font-medium text-blue-600 mb-2">总报警数</div>
          <div className="text-3xl font-bold text-blue-900">{stats.total}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="text-sm font-medium text-green-600 mb-2">已确认</div>
          <div className="text-3xl font-bold text-green-900">{stats.confirmed}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="text-sm font-medium text-red-600 mb-2">误报数</div>
          <div className="text-3xl font-bold text-red-900">{stats.falseAlarms}</div>
        </Card>
        <Card className="p-6 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
          <div className="text-sm font-medium text-yellow-600 mb-2">误报率</div>
          <div className="text-3xl font-bold text-yellow-900">{stats.falseAlarmRate}%</div>
        </Card>
      </div>

      {/* 图表 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 事件类型分布 */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">事件类型分布</h3>
          {stats.eventDistribution.length > 0 ? (
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
                    <Cell key={`cell-${index}`} fill={EVENT_COLORS[EVENT_TYPES[index]] || "#8884d8"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">暂无数据</div>
          )}
        </Card>

        {/* 复核状态分布 */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">复核状态分布</h3>
          {stats.reviewStatusDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.reviewStatusDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">暂无数据</div>
          )}
        </Card>
      </div>

      {/* 时间趋势 */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">报警趋势（最近30天）</h3>
        {stats.trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={stats.trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" name="报警数" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">暂无数据</div>
        )}
      </Card>
    </div>
  );
}
