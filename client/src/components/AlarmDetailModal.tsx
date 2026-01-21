import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AudioPlayer } from "@/components/AudioPlayer";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle, XCircle } from "lucide-react";
import type { AlarmRecord } from "@/lib/types";

interface AlarmDetailModalProps {
  alarm: AlarmRecord;
  isOpen: boolean;
  onClose: () => void;
  onReviewSuccess?: () => void;
}

const eventTypeLabels: Record<string, string> = {
  fall: "摔倒",
  scream: "尖叫",
  cough: "咳嗽",
  moan: "呻吟",
};

export function AlarmDetailModal({
  alarm,
  isOpen,
  onClose,
  onReviewSuccess,
}: AlarmDetailModalProps) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reviewMutation = trpc.alarms.review.useMutation({
    onSuccess: () => {
      toast.success("复核成功");
      setNotes("");
      onReviewSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "复核失败");
    },
  });

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await reviewMutation.mutateAsync({
        id: alarm.id,
        status: "confirmed",
        notes,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFalseAlarm = async () => {
    setIsSubmitting(true);
    try {
      await reviewMutation.mutateAsync({
        id: alarm.id,
        status: "falseAlarm",
        notes,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>报警详情</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 报警信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">事件类型</p>
              <p className="text-lg font-semibold">
                {eventTypeLabels[alarm.eventType]}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">置信度</p>
              <p className="text-lg font-semibold text-primary">
                {alarm.confidenceScore}%
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">老人ID</p>
              <p className="text-lg font-semibold">{alarm.elderlyId}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">时间</p>
              <p className="text-lg font-semibold">
                {new Date(alarm.createdAt).toLocaleString("zh-CN")}
              </p>
            </div>
          </div>

          {/* 音频播放 */}
          <div className="border-t pt-6">
            <p className="text-sm font-semibold mb-4">音频片段</p>
            <AudioPlayer audioUrl={alarm.audioUrl} />
          </div>

          {/* 复核备注 */}
          {alarm.reviewStatus === "pending" && (
            <div className="border-t pt-6">
              <label className="text-sm font-semibold mb-2 block">
                复核备注（可选）
              </label>
              <Textarea
                placeholder="输入您的复核意见..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          )}

          {/* 复核状态显示 */}
          {alarm.reviewStatus !== "pending" && (
            <div className="border-t pt-6 bg-muted p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {alarm.reviewStatus === "confirmed" ? (
                  <>
                    <CheckCircle className="text-green-600" size={20} />
                    <span className="font-semibold text-green-700">
                      已确认危险
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="text-gray-600" size={20} />
                    <span className="font-semibold text-gray-700">误报</span>
                  </>
                )}
              </div>
              {alarm.reviewNotes && (
                <p className="text-sm text-muted-foreground">
                  备注：{alarm.reviewNotes}
                </p>
              )}
              {alarm.reviewedAt && (
                <p className="text-xs text-muted-foreground mt-2">
                  复核时间：{new Date(alarm.reviewedAt).toLocaleString("zh-CN")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {alarm.reviewStatus === "pending" && (
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleFalseAlarm}
              disabled={isSubmitting}
              className="gap-2"
            >
              <XCircle size={16} />
              标记误报
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="gap-2"
            >
              <CheckCircle size={16} />
              确认危险
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
