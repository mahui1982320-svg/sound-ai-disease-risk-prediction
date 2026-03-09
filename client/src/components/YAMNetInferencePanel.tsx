import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Zap, Volume2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface YAMNetLabel {
  label: string;
  confidence: number;
}

interface YAMNetInferenceDetails {
  topLabels: YAMNetLabel[];
  mappedEventType: "fall" | "scream" | "cough" | "moan" | null;
  mappingConfidence: number | null;
  processingTime: number | null;
  audioLength: number | null;
  modelVersion: string | null;
}

interface YAMNetInferencePanelProps {
  data: YAMNetInferenceDetails | null;
  isLoading?: boolean;
}

const eventTypeColors: Record<string, string> = {
  fall: "bg-red-100 text-red-800 border-red-300",
  scream: "bg-orange-100 text-orange-800 border-orange-300",
  cough: "bg-yellow-100 text-yellow-800 border-yellow-300",
  moan: "bg-purple-100 text-purple-800 border-purple-300",
};

const eventTypeLabels: Record<string, string> = {
  fall: "摔倒",
  scream: "尖叫",
  cough: "咳嗽",
  moan: "呻吟",
};

export function YAMNetInferencePanel({
  data,
  isLoading = false,
}: YAMNetInferencePanelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain size={20} />
            YAMNet推理详情
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

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain size={20} />
            YAMNet推理详情
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32 text-gray-500">
            <div className="text-center">
              <AlertCircle size={32} className="mx-auto mb-2 opacity-50" />
              <p>暂无推理数据</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const confidencePercentage = data.mappingConfidence ? Math.round(data.mappingConfidence) : 0;
  const confidenceColor =
    confidencePercentage >= 80
      ? "text-green-600"
      : confidencePercentage >= 60
        ? "text-yellow-600"
        : "text-red-600";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain size={20} className="text-blue-600" />
            <div>
              <CardTitle>YAMNet推理详情</CardTitle>
              <CardDescription>实时音频事件分析结果</CardDescription>
            </div>
          </div>
          {data.mappedEventType && (
            <Badge className={cn("text-sm", eventTypeColors[data.mappedEventType])}>
              {eventTypeLabels[data.mappedEventType]}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* 映射事件类型和置信度 */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">识别事件</span>
              {data.mappedEventType && (
                <span className="text-lg font-bold text-gray-900">
                  {eventTypeLabels[data.mappedEventType]}
                </span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">识别置信度</span>
                <span className={cn("text-lg font-bold", confidenceColor)}>
                  {confidencePercentage}%
                </span>
              </div>
              <Progress
                value={confidencePercentage}
                className="h-2"
              />
            </div>
          </div>
        </div>

        {/* 性能指标 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} className="text-yellow-600" />
              <span className="text-xs font-medium text-gray-600">推理时间</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{data.processingTime}ms</p>
            <p className="text-xs text-gray-500 mt-1">处理耗时</p>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 size={16} className="text-blue-600" />
              <span className="text-xs font-medium text-gray-600">音频长度</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{data.audioLength}ms</p>
            <p className="text-xs text-gray-500 mt-1">采集时长</p>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Clock size={16} className="text-purple-600" />
              <span className="text-xs font-medium text-gray-600">模型版本</span>
            </div>
            <p className="text-sm font-bold text-gray-900 truncate">{data.modelVersion}</p>
            <p className="text-xs text-gray-500 mt-1">YAMNet</p>
          </div>
        </div>

        {/* 顶部标签分析 */}
        <Tabs defaultValue="top3" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="top3">顶部标签</TabsTrigger>
            <TabsTrigger value="details">详细分析</TabsTrigger>
          </TabsList>

          <TabsContent value="top3" className="space-y-3 mt-4">
            <p className="text-sm text-gray-600 mb-3">
              YAMNet模型识别的置信度最高的音频事件
            </p>
            {data.topLabels.length > 0 ? (
              <div className="space-y-3">
                {data.topLabels.map((label, idx) => {
                  const confidence = Math.round(label.confidence * 100);
                  const isHighConfidence = confidence >= 80;
                  const isMediumConfidence = confidence >= 50;

                  return (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {label.label}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "text-sm font-bold",
                            isHighConfidence
                              ? "text-green-600"
                              : isMediumConfidence
                                ? "text-yellow-600"
                                : "text-gray-600"
                          )}
                        >
                          {confidence}%
                        </span>
                      </div>
                      <Progress
                        value={confidence}
                        className="h-2"
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <p>暂无标签数据</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="details" className="space-y-3 mt-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-gray-900 mb-3">推理详情</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">识别事件类型：</span>
                  <span className="font-medium text-gray-900">
                    {data.mappedEventType
                      ? eventTypeLabels[data.mappedEventType]
                      : "未识别"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">映射置信度：</span>
                  <span className={cn("font-medium", confidenceColor)}>
                    {confidencePercentage}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">推理耗时：</span>
                  <span className="font-medium text-gray-900">{data.processingTime ?? "N/A"}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">音频长度：</span>
                  <span className="font-medium text-gray-900">{data.audioLength ?? "N/A"}ms</span>
                </div>
              </div>
            </div>

            {/* 性能评估 */}
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-medium text-gray-900 mb-3">性能评估</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-600"></div>
                  <span className="text-gray-700">
                    推理速度：
                    <span className="font-medium text-gray-900 ml-1">
                      {data.processingTime === null
                        ? "N/A"
                        : data.processingTime < 200
                          ? "优秀 (< 200ms)"
                          : data.processingTime < 500
                            ? "良好 (< 500ms)"
                            : "需要优化"}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                  <span className="text-gray-700">
                    识别准确度：
                    <span className="font-medium text-gray-900 ml-1">
                      {confidencePercentage >= 80
                        ? "高 (≥ 80%)"
                        : confidencePercentage >= 60
                          ? "中等 (≥ 60%)"
                          : "低 (< 60%)"}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-600"></div>
                  <span className="text-gray-700">
                    音频采集：
                    <span className="font-medium text-gray-900 ml-1">
                      {data.audioLength === null
                        ? "N/A"
                        : data.audioLength >= 1000
                          ? "充足"
                          : "较短"}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* 建议 */}
        <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
          <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
            <AlertCircle size={16} className="text-amber-600" />
            推理建议
          </h4>
          <ul className="text-sm text-gray-700 space-y-1">
            {confidencePercentage < 60 && (
              <li>• 置信度较低，建议人工复核确认</li>
            )}
            {data.processingTime !== null && data.processingTime > 500 && (
              <li>• 推理耗时较长，可能需要优化硬件配置</li>
            )}
            {data.audioLength !== null && data.audioLength < 500 && (
              <li>• 音频采集时间较短，可能影响识别准确度</li>
            )}
            {confidencePercentage >= 80 && data.processingTime !== null && data.processingTime < 200 && (
              <li>• 推理效果良好，可信度高</li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
