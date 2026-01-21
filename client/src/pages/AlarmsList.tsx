import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
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
} from "lucide-react";
import { useState } from "react";
// import { AlarmDetailModal } from "@/components/AlarmDetailModal";

type ReviewStatus = "pending" | "confirmed" | "falseAlarm";

const eventTypeLabels: Record<string, string> = {
  fall: "摔倒",
  scream: "尖叫",
  cough: "咳嗽",
  moan: "呻吟",
};

const eventTypeColors: Record<string, string> = {
  fall: "event-fall",
  scream: "event-scream",
  cough: "event-cough",
  moan: "event-moan",
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

export default function AlarmsList() {
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [selectedAlarmId, setSelectedAlarmId] = useState<number | null>(null);

  const { data: alarms, isLoading } = trpc.alarms.list.useQuery({
    limit: 50,
    offset: 0,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const selectedAlarm = alarms?.find((a) => a.id === selectedAlarmId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 页面头部 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">报警管理</h1>
            <p className="text-muted-foreground mt-1">
              查看和处理所有安全报警记录
            </p>
          </div>
        </div>

        {/* 筛选器 */}
        <div className="flex gap-4 items-center">
          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(value as ReviewStatus | "all")
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="筛选状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="pending">待复核</SelectItem>
              <SelectItem value="confirmed">已确认</SelectItem>
              <SelectItem value="falseAlarm">误报</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 报警列表 */}
        <div className="space-y-4">
          {isLoading ? (
            // 加载骨架屏
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="h-20 w-full" />
              </Card>
            ))
          ) : alarms && alarms.length > 0 ? (
            alarms.map((alarm) => (
              <Card
                key={alarm.id}
                className="p-4 cursor-pointer hover:shadow-md transition-all"
                onClick={() => setSelectedAlarmId(alarm.id)}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* 左侧信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={eventTypeColors[alarm.eventType]}>
                        {eventTypeLabels[alarm.eventType]}
                      </span>
                      <span className={`status-${alarm.reviewStatus}`}>
                        {statusIcons[alarm.reviewStatus as ReviewStatus]}
                        {statusLabels[alarm.reviewStatus as ReviewStatus]}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User size={16} />
                        <span>老人 ID: {alarm.elderlyId}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock size={16} />
                        <span>
                          {new Date(alarm.createdAt).toLocaleString("zh-CN")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 右侧信息 */}
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">置信度</div>
                      <div className="text-2xl font-bold text-primary">
                        {alarm.confidenceScore}%
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAlarmId(alarm.id);
                      }}
                      className="gap-2"
                    >
                      <Volume2 size={16} />
                      播放
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">暂无报警记录</p>
            </Card>
          )}
        </div>
      </div>

      {/* TODO: 实现报警详情模态框 */}
    </DashboardLayout>
  );
}
