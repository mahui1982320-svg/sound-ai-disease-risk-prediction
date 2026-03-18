import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  Clock,
  Cpu,
  Volume2,
  Zap,
  TrendingUp,
  Shield,
  RefreshCw,
} from "lucide-react";

const dangerLevelLabels: Record<string, string> = {
  none: "正常",
  low: "低",
  medium: "中",
  high: "高",
  critical: "危急",
};

const dangerLevelColors: Record<string, string> = {
  none: "bg-gray-100 text-gray-700",
  low: "bg-blue-100 text-blue-700",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export default function EventMonitor() {
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [dangerOnly, setDangerOnly] = useState(false);

  const { data: devices } = trpc.raspberryPi.listDevices.useQuery();
  const { data: events, isLoading, refetch } = trpc.raspberryPi.listEvents.useQuery({
    deviceId: deviceFilter === "all" ? undefined : deviceFilter,
    dangerOnly,
    limit: 100,
  });
  const { data: stats } = trpc.raspberryPi.eventStats.useQuery({
    deviceId: deviceFilter === "all" ? undefined : deviceFilter,
  });

  const onlineDevices = useMemo(() => devices?.filter(d => d.isOnline).length || 0, [devices]);
  const totalDevices = devices?.length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">事件监控</h1>
          <p className="text-sm text-gray-600 mt-1">实时查看树莓派上传的声音事件</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="flex items-center gap-2">
          <RefreshCw size={16} />
          刷新
        </Button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Cpu size={18} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-600">设备状态</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">{onlineDevices}/{totalDevices}</div>
          <p className="text-xs text-blue-600 mt-1">在线/总数</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center gap-2 mb-2">
            <Activity size={18} className="text-green-600" />
            <span className="text-sm font-medium text-green-600">总事件数</span>
          </div>
          <div className="text-2xl font-bold text-green-900">{stats?.totalEvents || 0}</div>
          <p className="text-xs text-green-600 mt-1">24h: {stats?.recentEvents24h || 0}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={18} className="text-red-600" />
            <span className="text-sm font-medium text-red-600">危险事件</span>
          </div>
          <div className="text-2xl font-bold text-red-900">{stats?.dangerEvents || 0}</div>
          <p className="text-xs text-red-600 mt-1">24h: {stats?.recentDangerEvents24h || 0}</p>
        </Card>
        <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={18} className="text-purple-600" />
            <span className="text-sm font-medium text-purple-600">平均推理</span>
          </div>
          <div className="text-2xl font-bold text-purple-900">{stats?.avgProcessingTime || 0}ms</div>
          <p className="text-xs text-purple-600 mt-1">推理耗时</p>
        </Card>
      </div>

      {/* 筛选栏 */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">设备：</label>
          <Select value={deviceFilter} onValueChange={setDeviceFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部设备</SelectItem>
              {devices?.map((d) => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  {d.deviceName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant={dangerOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setDangerOnly(!dangerOnly)}
          className="flex items-center gap-1"
        >
          <Shield size={14} />
          {dangerOnly ? "仅危险事件" : "全部事件"}
        </Button>
      </div>

      {/* 热门分类 */}
      {stats?.topClasses && stats.topClasses.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp size={16} />
            热门声音分类
          </h3>
          <div className="flex flex-wrap gap-2">
            {stats.topClasses.map((cls) => (
              <Badge key={cls.name} variant="secondary" className="text-sm">
                {cls.name}: {cls.count}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* 事件列表 */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : events && events.length > 0 ? (
        <div className="space-y-3">
          {events.map((event) => (
            <Card
              key={event.id}
              className={`p-4 border ${
                event.isDanger
                  ? "border-red-200 bg-red-50/50"
                  : "border-gray-200"
              } hover:shadow-md transition-shadow`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${event.isDanger ? "bg-red-100" : "bg-gray-100"}`}>
                    {event.isDanger ? (
                      <AlertTriangle size={20} className="text-red-600" />
                    ) : (
                      <Volume2 size={20} className="text-gray-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{event.primaryClassName}</span>
                      <Badge className={dangerLevelColors[event.dangerLevel]}>
                        {dangerLevelLabels[event.dangerLevel]}
                      </Badge>
                      {event.alarmRecordId && (
                        <Badge variant="destructive" className="text-xs">已报警 #{event.alarmRecordId}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(event.createdAt).toLocaleString("zh-CN")}
                      </span>
                      <span className="font-mono">ID: {event.primaryClassId}</span>
                      <span>置信度: {(event.primaryConfidence * 100).toFixed(1)}%</span>
                      {event.processingTimeMs && <span>{event.processingTimeMs}ms</span>}
                      {event.rmsVolume && <span>RMS: {event.rmsVolume.toFixed(4)}</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {(event.primaryConfidence * 100).toFixed(0)}%
                  </div>
                  {event.audioUrl && (
                    <a
                      href={event.audioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      播放音频
                    </a>
                  )}
                </div>
              </div>

              {/* Top Labels */}
              {event.topLabels && (() => {
                try {
                  const labels = JSON.parse(event.topLabels);
                  if (Array.isArray(labels) && labels.length > 1) {
                    return (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex flex-wrap gap-2">
                          {labels.slice(0, 5).map((label: { class_name: string; confidence: number }, idx: number) => (
                            <span key={idx} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                              {label.class_name}: {(label.confidence * 100).toFixed(1)}%
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                } catch { /* ignore parse errors */ }
                return null;
              })()}
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Activity size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">暂无事件记录</p>
          <p className="text-sm text-gray-400 mt-2">树莓派检测到声音事件后将自动上传到这里</p>
        </div>
      )}
    </div>
  );
}
