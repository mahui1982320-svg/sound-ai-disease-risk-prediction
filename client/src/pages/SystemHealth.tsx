import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import {
  Cpu,
  Thermometer,
  HardDrive,
  Clock,
  Wifi,
  WifiOff,
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function formatUptime(seconds: number | null | undefined): string {
  if (!seconds) return "未知";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}天 ${hours}小时 ${mins}分钟`;
  if (hours > 0) return `${hours}小时 ${mins}分钟`;
  return `${mins}分钟`;
}

function getTempColor(temp: number | null | undefined): string {
  if (!temp) return "text-gray-400";
  if (temp >= 80) return "text-red-600";
  if (temp >= 65) return "text-orange-500";
  if (temp >= 50) return "text-yellow-500";
  return "text-green-600";
}

function getTempBg(temp: number | null | undefined): string {
  if (!temp) return "bg-gray-100";
  if (temp >= 80) return "bg-red-50 border-red-200";
  if (temp >= 65) return "bg-orange-50 border-orange-200";
  if (temp >= 50) return "bg-yellow-50 border-yellow-200";
  return "bg-green-50 border-green-200";
}

function getUsageColor(usage: number | null | undefined): string {
  if (!usage) return "text-gray-400";
  if (usage >= 90) return "text-red-600";
  if (usage >= 70) return "text-orange-500";
  if (usage >= 50) return "text-yellow-500";
  return "text-green-600";
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

function getProgressColor(value: number | null | undefined): string {
  if (!value) return "bg-gray-300";
  if (value >= 90) return "bg-red-500";
  if (value >= 70) return "bg-orange-400";
  if (value >= 50) return "bg-yellow-400";
  return "bg-green-500";
}

export default function SystemHealth() {
  const { data: devices, isLoading, refetch } = trpc.raspberryPi.listDevices.useQuery(undefined, {
    refetchInterval: 15000, // 每 15 秒自动刷新
  });

  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    if (devices) {
      setLastRefresh(new Date());
    }
  }, [devices]);

  const onlineDevices = useMemo(() => devices?.filter(d => d.isOnline) || [], [devices]);
  const offlineDevices = useMemo(() => devices?.filter(d => !d.isOnline && d.lastHeartbeat) || [], [devices]);
  const neverConnected = useMemo(() => devices?.filter(d => !d.lastHeartbeat) || [], [devices]);

  const overallStatus = useMemo(() => {
    if (!devices || devices.length === 0) return "empty";
    if (offlineDevices.length > 0) return "warning";
    if (onlineDevices.length === devices.length) return "healthy";
    return "partial";
  }, [devices, onlineDevices, offlineDevices]);

  const statusConfig = {
    empty: { icon: Server, label: "暂无设备", color: "text-gray-500", bg: "bg-gray-50 border-gray-200" },
    healthy: { icon: CheckCircle2, label: "全部正常", color: "text-green-600", bg: "bg-green-50 border-green-200" },
    warning: { icon: AlertTriangle, label: "部分离线", color: "text-orange-600", bg: "bg-orange-50 border-orange-200" },
    partial: { icon: Activity, label: "运行中", color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  };

  const currentStatus = statusConfig[overallStatus];
  const StatusIcon = currentStatus.icon;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">系统健康</h1>
          <p className="text-sm text-gray-600 mt-1">
            实时监控所有设备的运行状态 · 上次刷新: {lastRefresh.toLocaleTimeString("zh-CN")}
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="flex items-center gap-2">
          <RefreshCw size={16} />
          刷新
        </Button>
      </div>

      {/* 总体状态卡片 */}
      <Card className={`p-6 border-2 ${currentStatus.bg}`}>
        <div className="flex items-center gap-4">
          <div className={`p-3 rounded-xl ${currentStatus.bg}`}>
            <StatusIcon size={32} className={currentStatus.color} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className={`text-2xl font-bold ${currentStatus.color}`}>{currentStatus.label}</h2>
              <Badge variant="outline" className="text-xs">
                自动刷新中
              </Badge>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              {onlineDevices.length} 台在线 · {offlineDevices.length} 台离线 · {neverConnected.length} 台未连接
            </p>
          </div>
        </div>
      </Card>

      {/* 离线设备警告 */}
      {offlineDevices.length > 0 && (
        <Card className="p-4 bg-red-50 border-red-200">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className="text-red-600" />
            <h3 className="font-semibold text-red-800">离线设备警告</h3>
          </div>
          <div className="space-y-2">
            {offlineDevices.map(device => {
              const offlineMinutes = device.lastHeartbeat
                ? Math.round((Date.now() - new Date(device.lastHeartbeat).getTime()) / 60000)
                : 0;
              return (
                <div key={device.id} className="flex items-center justify-between bg-white/60 rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <WifiOff size={16} className="text-red-500" />
                    <div>
                      <span className="font-medium text-gray-900">{device.deviceName}</span>
                      <span className="text-sm text-gray-500 ml-2">({device.deviceId})</span>
                    </div>
                  </div>
                  <span className="text-sm text-red-600 font-medium">
                    离线 {offlineMinutes} 分钟
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 设备详细状态 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {onlineDevices.map(device => (
          <Card key={device.id} className="p-5 border border-green-200 bg-white hover:shadow-md transition-shadow">
            {/* 设备头部 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100">
                  <Cpu size={20} className="text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{device.deviceName}</h3>
                  <p className="text-xs text-gray-500 font-mono">{device.deviceId}</p>
                </div>
              </div>
              <Badge className="bg-green-500 text-white flex items-center gap-1">
                <Wifi size={12} />
                在线
              </Badge>
            </div>

            {/* 状态指标 */}
            <div className="grid grid-cols-2 gap-3">
              {/* CPU 温度 */}
              <div className={`p-3 rounded-lg border ${getTempBg(device.cpuTemp)}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Thermometer size={14} className={getTempColor(device.cpuTemp)} />
                  <span className="text-xs font-medium text-gray-600">CPU 温度</span>
                </div>
                <div className={`text-xl font-bold ${getTempColor(device.cpuTemp)}`}>
                  {device.cpuTemp ? `${device.cpuTemp.toFixed(1)}°C` : "--"}
                </div>
              </div>

              {/* CPU 使用率 */}
              <div className="p-3 rounded-lg border bg-gray-50">
                <div className="flex items-center gap-2 mb-1">
                  <Activity size={14} className={getUsageColor(device.cpuUsage)} />
                  <span className="text-xs font-medium text-gray-600">CPU 使用率</span>
                </div>
                <div className={`text-xl font-bold ${getUsageColor(device.cpuUsage)}`}>
                  {device.cpuUsage ? `${device.cpuUsage.toFixed(0)}%` : "--"}
                </div>
                {device.cpuUsage !== null && device.cpuUsage !== undefined && (
                  <ProgressBar value={device.cpuUsage} color={getProgressColor(device.cpuUsage)} />
                )}
              </div>

              {/* 内存使用率 */}
              <div className="p-3 rounded-lg border bg-gray-50">
                <div className="flex items-center gap-2 mb-1">
                  <HardDrive size={14} className={getUsageColor(device.memoryUsage)} />
                  <span className="text-xs font-medium text-gray-600">内存使用率</span>
                </div>
                <div className={`text-xl font-bold ${getUsageColor(device.memoryUsage)}`}>
                  {device.memoryUsage ? `${device.memoryUsage.toFixed(0)}%` : "--"}
                </div>
                {device.memoryUsage !== null && device.memoryUsage !== undefined && (
                  <ProgressBar value={device.memoryUsage} color={getProgressColor(device.memoryUsage)} />
                )}
              </div>

              {/* 运行时长 */}
              <div className="p-3 rounded-lg border bg-gray-50">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={14} className="text-blue-500" />
                  <span className="text-xs font-medium text-gray-600">运行时长</span>
                </div>
                <div className="text-lg font-bold text-blue-600">
                  {formatUptime(device.uptime)}
                </div>
              </div>
            </div>

            {/* 底部信息 */}
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>最后心跳: {device.lastHeartbeat ? new Date(device.lastHeartbeat).toLocaleString("zh-CN") : "从未"}</span>
              {device.modelVersion && <span>模型: {device.modelVersion}</span>}
            </div>
          </Card>
        ))}

        {/* 离线设备也显示卡片（灰色） */}
        {offlineDevices.map(device => (
          <Card key={device.id} className="p-5 border border-gray-200 bg-gray-50 opacity-75">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-200">
                  <Cpu size={20} className="text-gray-400" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-600">{device.deviceName}</h3>
                  <p className="text-xs text-gray-400 font-mono">{device.deviceId}</p>
                </div>
              </div>
              <Badge variant="secondary" className="flex items-center gap-1">
                <WifiOff size={12} />
                离线
              </Badge>
            </div>
            <div className="text-center py-6 text-gray-400">
              <WifiOff size={32} className="mx-auto mb-2" />
              <p className="text-sm">设备离线，等待重新连接...</p>
              <p className="text-xs mt-1">
                最后在线: {device.lastHeartbeat ? new Date(device.lastHeartbeat).toLocaleString("zh-CN") : "从未连接"}
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* 无设备提示 */}
      {(!devices || devices.length === 0) && (
        <Card className="p-12 text-center">
          <Server size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">暂无注册设备</p>
          <p className="text-sm text-gray-400 mt-2">请先在"设备管理"中注册树莓派设备</p>
        </Card>
      )}
    </div>
  );
}
