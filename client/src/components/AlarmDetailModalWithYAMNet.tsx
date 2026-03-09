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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AudioPlayer } from "@/components/AudioPlayer";
import { YAMNetInferencePanel } from "@/components/YAMNetInferencePanel";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { CheckCircle, XCircle, MapPin, Heart, Users, Phone, Brain } from "lucide-react";
import type { AlarmRecord, Elderly } from "@/lib/types";

interface AlarmDetailModalWithYAMNetProps {
  alarm: AlarmRecord;
  elderly?: Elderly | null;
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

export function AlarmDetailModalWithYAMNet({
  alarm,
  elderly,
  isOpen,
  onClose,
  onReviewSuccess,
}: AlarmDetailModalWithYAMNetProps) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 获取YAMNet推理详情
  const { data: yamnetDetails, isLoading: yamnetLoading } = trpc.alarms.getYAMNetDetails.useQuery(
    { alarmId: alarm.id },
    { enabled: isOpen }
  );

  const reviewMutation = trpc.alarms.review.useMutation({
    onSuccess: () => {
      toast.success("复核成功");
      setNotes("");
      onReviewSuccess?.();
      onClose();
    },
    onError: () => {
      toast.error("复核失败");
    },
  });

  const handleReview = async (status: "confirmed" | "falseAlarm") => {
    setIsSubmitting(true);
    try {
      await reviewMutation.mutateAsync({
        id: alarm.id,
        status,
        notes: notes || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>报警详情分析</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="yamnet" className="flex items-center gap-2">
              <Brain size={16} />
              YAMNet分析
            </TabsTrigger>
            <TabsTrigger value="review">复核</TabsTrigger>
          </TabsList>

          {/* 概览标签页 */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* 老人信息 */}
            {elderly && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-3">老人信息</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">姓名：</span>
                    <span className="text-gray-900">{elderly.name}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">房间号：</span>
                    <span className="text-gray-900">{elderly.roomNumber}</span>
                  </div>
                  {elderly.address && (
                    <div className="col-span-2 flex items-start gap-2">
                      <MapPin size={16} className="mt-0.5 text-gray-600" />
                      <div>
                        <span className="font-medium text-gray-700">地址：</span>
                        <span className="text-gray-900">{elderly.address}</span>
                      </div>
                    </div>
                  )}
                  {elderly.healthStatus && (
                    <div className="col-span-2 flex items-start gap-2">
                      <Heart size={16} className="mt-0.5 text-gray-600" />
                      <div>
                        <span className="font-medium text-gray-700">身体情况：</span>
                        <span className="text-gray-900">{elderly.healthStatus}</span>
                      </div>
                    </div>
                  )}
                  {elderly.carerName && (
                    <div className="col-span-2 flex items-start gap-2">
                      <Users size={16} className="mt-0.5 text-gray-600" />
                      <div>
                        <span className="font-medium text-gray-700">护理员：</span>
                        <span className="text-gray-900">{elderly.carerName}</span>
                        {elderly.carerPhone && (
                          <div className="flex items-center gap-1 mt-1">
                            <Phone size={14} />
                            <span>{elderly.carerPhone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 报警信息 */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-3">报警信息</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">事件类型：</span>
                  <span className="text-gray-900">{eventTypeLabels[alarm.eventType]}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700">置信度：</span>
                  <span className="text-lg font-bold text-blue-600">{alarm.confidenceScore}%</span>
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-gray-700">时间：</span>
                  <span className="text-gray-900">{new Date(alarm.createdAt).toLocaleString('zh-CN')}</span>
                </div>
              </div>
            </div>

            {/* 音频播放 */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">音频片段</h3>
              <AudioPlayer audioUrl={alarm.audioUrl} />
            </div>
          </TabsContent>

          {/* YAMNet分析标签页 */}
          <TabsContent value="yamnet" className="mt-4">
            <YAMNetInferencePanel
              data={yamnetDetails || null}
              isLoading={yamnetLoading}
            />
          </TabsContent>

          {/* 复核标签页 */}
          <TabsContent value="review" className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                复核备注（可选）
              </label>
              <Textarea
                placeholder="输入您的复核意见..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-32"
              />
            </div>

            {/* 复核建议 */}
            {yamnetDetails && yamnetDetails.mappingConfidence !== null && (
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-medium text-gray-900 mb-2">复核建议</h4>
                <ul className="text-sm text-gray-700 space-y-1">
                  {yamnetDetails.mappingConfidence >= 80 && (
                    <li>✓ YAMNet置信度高，该事件可能为真实警报</li>
                  )}
                  {yamnetDetails.mappingConfidence < 60 && (
                    <li>⚠ YAMNet置信度低，建议仔细听取音频后判断</li>
                  )}
                  {yamnetDetails.processingTime !== null && yamnetDetails.processingTime < 200 && (
                    <li>✓ 推理速度快，系统性能良好</li>
                  )}
                  {yamnetDetails.audioLength !== null && yamnetDetails.audioLength >= 1500 && (
                    <li>✓ 音频采集充足，识别结果可信度较高</li>
                  )}
                </ul>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex gap-2 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            关闭
          </Button>
          <Button
            variant="destructive"
            onClick={() => handleReview("falseAlarm")}
            disabled={isSubmitting}
            className="flex items-center gap-2"
          >
            <XCircle size={16} />
            标记误报
          </Button>
          <Button
            onClick={() => handleReview("confirmed")}
            disabled={isSubmitting}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle size={16} />
            确认危险
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
