import { useEffect, useState, ReactNode } from 'react';
import { useRealtimeInference, InferenceMessage } from '@/hooks/useRealtimeInference';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';

interface RealtimeInferenceMonitorProps {
  elderlyId: string;
  serverUrl?: string;
}

/**
 * 实时推理监控组件 - 显示WebSocket实时推理结果
 */
export function RealtimeInferenceMonitor({
  elderlyId,
  serverUrl = 'wss://eldersafe-fv6io3sc.manus.space/ws'
}: RealtimeInferenceMonitorProps) {
  const [error, setError] = useState<string | null>(null);
  const [eventCounts, setEventCounts] = useState<Record<string, number>>({});

  const { isConnected, inferences, stats, register } = useRealtimeInference(
    serverUrl,
    (message: InferenceMessage) => {
      // 更新事件计数
      if (message.inference && message.inference.length > 0) {
        const eventName = message.inference[0].class_name;
        setEventCounts(prev => ({
          ...prev,
          [eventName]: (prev[eventName] || 0) + 1
        }));
      }
    },
    (errorMsg: string) => {
      setError(errorMsg);
      setTimeout(() => setError(null), 5000);
    }
  );

  // 注册设备
  useEffect(() => {
    register(`device_${elderlyId}`, elderlyId, 'device_token');
  }, [elderlyId, register]);

  // 获取事件类型的颜色
  const getEventColor = (eventName: string): string => {
    const colorMap: Record<string, string> = {
      '尖叫': 'bg-red-100 text-red-800',
      '摔倒': 'bg-orange-100 text-orange-800',
      '咳嗽': 'bg-yellow-100 text-yellow-800',
      '呻吟': 'bg-purple-100 text-purple-800',
      '求救': 'bg-red-100 text-red-800'
    };
    return colorMap[eventName] || 'bg-gray-100 text-gray-800';
  };

  // 获取事件图标
  const getEventIcon = (eventName: string): ReactNode => {
    const iconMap: Record<string, ReactNode> = {
      '尖叫': <AlertCircle className="w-4 h-4" />,
      '摔倒': <AlertCircle className="w-4 h-4" />,
      '咳嗽': <CheckCircle className="w-4 h-4" />,
      '呻吟': <AlertCircle className="w-4 h-4" />,
      '求救': <AlertCircle className="w-4 h-4" />
    };
    return iconMap[eventName] || <Zap className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4">
      {/* 连接状态 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            <span>实时连接状态</span>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                }`}
              />
              <span className="text-xs font-normal">
                {isConnected ? '✓ 已连接' : '✗ 未连接'}
              </span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">总推理数</p>
              <p className="text-2xl font-bold">{stats.totalMessages}</p>
            </div>
            <div>
              <p className="text-gray-600">延迟</p>
              <p className="text-2xl font-bold">{stats.latencyMs}ms</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* 事件统计 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">事件统计</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(eventCounts).map(([eventName, count]) => (
              <div key={eventName} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getEventIcon(eventName)}
                  <span className="text-sm">{eventName}</span>
                </div>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
            {Object.keys(eventCounts).length === 0 && (
              <p className="text-sm text-gray-500">暂无数据</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 推理结果列表 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">最近推理结果</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {inferences.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                等待推理结果...
              </p>
            ) : (
              inferences.map((inf, idx) => {
                const mainEvent = inf.inference?.[0];
                if (!mainEvent) return null;

                return (
                  <div
                    key={idx}
                    className={`p-3 rounded border-l-4 ${getEventColor(mainEvent.class_name)}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getEventIcon(mainEvent.class_name)}
                        <div>
                          <p className="font-medium text-sm">
                            {mainEvent.class_name}
                          </p>
                          <p className="text-xs opacity-75">
                            设备: {inf.deviceId}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">
                          {(mainEvent.confidence * 100).toFixed(1)}%
                        </p>
                        <p className="text-xs opacity-75 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {inf.latency}ms
                        </p>
                      </div>
                    </div>

                    {/* 其他候选事件 */}
                    {inf.inference && inf.inference.length > 1 && (
                      <div className="mt-2 pt-2 border-t border-current border-opacity-20 space-y-1">
                        {inf.inference.slice(1, 3).map((event, i) => (
                          <div key={i} className="text-xs opacity-75 flex justify-between">
                            <span>{event.class_name}</span>
                            <span>{(event.confidence * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 时间戳 */}
                    <p className="text-xs opacity-50 mt-2">
                      {new Date(inf.timestamp || 0).toLocaleTimeString()}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* 系统信息 */}
      <Card className="bg-gray-50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-gray-600">老人ID</p>
              <p className="font-mono text-gray-800">{elderlyId}</p>
            </div>
            <div>
              <p className="text-gray-600">最后更新</p>
              <p className="font-mono text-gray-800">
                {stats.lastUpdate.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default RealtimeInferenceMonitor;
