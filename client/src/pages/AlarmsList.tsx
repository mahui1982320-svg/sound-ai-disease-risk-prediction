import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  CheckCircle,
  XCircle,
  Volume2,
  Clock,
  User,
  MapPin,
  Heart,
  Users,
  Phone,
} from "lucide-react";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AlarmDetailModal } from "@/components/AlarmDetailModal";

type ReviewStatus = "pending" | "confirmed" | "falseAlarm";

const eventTypeLabels: Record<string, string> = {
  fall: "摔倒",
  scream: "尖叫",
  cough: "咳嗽",
  moan: "呻吟",
};

const statusLabels: Record<ReviewStatus, string> = {
  pending: "待复核",
  confirmed: "已确认",
  falseAlarm: "误报",
};

const statusIcons: Record<ReviewStatus, React.ReactNode> = {
  pending: <AlertCircle size={16} />,
  confirmed: <CheckCircle size={16} />,
  falseAlarm: <XCircle size={16} />,
};

const statusColors: Record<ReviewStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  falseAlarm: "bg-gray-100 text-gray-800",
};

export default function AlarmsList() {
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [selectedAlarmId, setSelectedAlarmId] = useState<number | null>(null);

  const { data: alarms, isLoading } = trpc.alarms.list.useQuery({
    limit: 50,
    offset: 0,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const selectedAlarm = alarms?.find(a => a.alarm.id === selectedAlarmId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">报警管理</h1>
        <p className="text-sm text-gray-600">查看和处理所有安全报警记录</p>
      </div>

      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">筛选状态：</label>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ReviewStatus | "all")}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="pending">待复核</SelectItem>
            <SelectItem value="confirmed">已确认</SelectItem>
            <SelectItem value="falseAlarm">误报</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {alarms && alarms.length > 0 ? (
          alarms.map((record) => (
            <Card
              key={record.alarm.id}
              className="p-6 hover:shadow-lg transition-shadow cursor-pointer border border-gray-200"
              onClick={() => setSelectedAlarmId(record.alarm.id)}
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 左侧：事件和状态 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      record.alarm.eventType === 'fall' ? 'bg-red-100 text-red-800' :
                      record.alarm.eventType === 'scream' ? 'bg-orange-100 text-orange-800' :
                      record.alarm.eventType === 'cough' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {eventTypeLabels[record.alarm.eventType]}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1 ${statusColors[record.alarm.reviewStatus as ReviewStatus]}`}>
                      {statusIcons[record.alarm.reviewStatus as ReviewStatus]}
                      {statusLabels[record.alarm.reviewStatus as ReviewStatus]}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Clock size={16} />
                    <span className="text-sm">{new Date(record.alarm.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                </div>

                {/* 中间：老人信息 */}
                <div className="space-y-2">
                  <h3 className="font-bold text-lg text-gray-900">{record.elderly?.name || '未知老人'}</h3>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <User size={14} />
                      <span>房间号：{record.elderly?.roomNumber}</span>
                    </div>
                    {record.elderly?.address && (
                      <div className="flex items-center gap-2">
                        <MapPin size={14} />
                        <span>{record.elderly.address}</span>
                      </div>
                    )}
                    {record.elderly?.healthStatus && (
                      <div className="flex items-center gap-2">
                        <Heart size={14} />
                        <span>{record.elderly.healthStatus}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 右侧：护理员和置信度 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">置信度</span>
                    <span className="text-2xl font-bold text-blue-600">{record.alarm.confidenceScore}%</span>
                  </div>
                  {record.elderly?.carerName && (
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Users size={14} />
                        <span>护理员：{record.elderly.carerName}</span>
                      </div>
                      {record.elderly.carerPhone && (
                        <div className="flex items-center gap-2 text-sm text-gray-700 mt-1">
                          <Phone size={14} />
                          <span>{record.elderly.carerPhone}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAlarmId(record.alarm.id);
                    }}
                  >
                    <Volume2 size={16} className="mr-2" />
                    播放音频
                  </Button>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">暂无报警记录</p>
          </div>
        )}
      </div>

      {selectedAlarm && (
        <AlarmDetailModal
          alarm={selectedAlarm.alarm}
          elderly={selectedAlarm.elderly}
          isOpen={selectedAlarmId !== null}
          onClose={() => setSelectedAlarmId(null)}
        />
      )}
    </div>
  );
}
