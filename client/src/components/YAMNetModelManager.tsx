import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle, Clock, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface YAMNetModel {
  id: number;
  version: string;
  name: string;
  description?: string | null;
  avgProcessingTime?: number | null;
  avgAccuracy?: number | null;
  supportedLabels: number;
  isActive: boolean;
  isDefault: boolean;
  releaseNotes?: string | null;
  createdAt: Date;
  deprecatedAt?: Date | null;
}

export function YAMNetModelManager() {
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);

  // 获取所有模型
  const { data: models, isLoading, refetch } = trpc.yamnetModels.listModels.useQuery();

  // 激活模型
  const { mutate: activateModel, isPending: isActivating } = trpc.yamnetModels.activateModel.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // 设置默认模型
  const { mutate: setDefaultModel, isPending: isSettingDefault } = trpc.yamnetModels.setDefaultModel.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  // 弃用模型
  const { mutate: deprecateModel, isPending: isDeprecating } = trpc.yamnetModels.deprecateModel.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const activeModel = models?.find((m: YAMNetModel) => m.isActive);
  const defaultModel = models?.find((m: YAMNetModel) => m.isDefault);
  const selectedModel = models?.find((m: YAMNetModel) => m.id === selectedModelId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>YAMNet模型管理</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-40">
            <div className="text-gray-500">加载中...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!models || models.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>YAMNet模型管理</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500">暂无模型版本</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 模型选择器 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            模型版本管理
          </CardTitle>
          <CardDescription>选择并管理不同版本的YAMNet模型</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">选择模型版本</label>
            <Select value={selectedModelId?.toString() || ""} onValueChange={(val) => setSelectedModelId(Number(val))}>
              <SelectTrigger>
                <SelectValue placeholder="选择一个模型版本" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model: YAMNetModel) => (
                  <SelectItem key={model.id} value={model.id.toString()}>
                    <div className="flex items-center gap-2">
                      <span>{model.version} - {model.name}</span>
                      {model.isActive && <Badge variant="default">活跃</Badge>}
                      {model.isDefault && <Badge variant="secondary">默认</Badge>}
                      {model.deprecatedAt && <Badge variant="destructive">已弃用</Badge>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 模型详情 */}
          {selectedModel && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">版本</p>
                  <p className="font-medium">{selectedModel.version}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">名称</p>
                  <p className="font-medium">{selectedModel.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">支持标签数</p>
                  <p className="font-medium">{selectedModel.supportedLabels}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">平均推理时间</p>
                  <p className="font-medium">{selectedModel.avgProcessingTime ?? "N/A"}ms</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">平均准确度</p>
                  <p className="font-medium">{selectedModel.avgAccuracy ?? "N/A"}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">创建时间</p>
                  <p className="font-medium">{new Date(selectedModel.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedModel.description && (
                <div>
                  <p className="text-sm text-gray-600">描述</p>
                  <p className="text-sm text-gray-800">{selectedModel.description}</p>
                </div>
              )}

              {selectedModel.releaseNotes && (
                <div>
                  <p className="text-sm text-gray-600">发布说明</p>
                  <p className="text-sm text-gray-800">{selectedModel.releaseNotes}</p>
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex gap-2 pt-2">
                {!selectedModel.isActive && (
                  <Button
                    size="sm"
                    onClick={() => activateModel({ id: selectedModel.id })}
                    disabled={isActivating}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    激活此模型
                  </Button>
                )}

                {!selectedModel.isDefault && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDefaultModel({ id: selectedModel.id })}
                    disabled={isSettingDefault}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    设为默认
                  </Button>
                )}

                {!selectedModel.deprecatedAt && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deprecateModel({ id: selectedModel.id })}
                    disabled={isDeprecating}
                    className="flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    弃用此模型
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 模型状态概览 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 活跃模型 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              活跃模型
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeModel ? (
              <div>
                <p className="font-semibold">{activeModel.version}</p>
                <p className="text-sm text-gray-600">{activeModel.name}</p>
                <p className="text-xs text-gray-500 mt-2">推理时间: {activeModel.avgProcessingTime ?? "N/A"}ms</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">未设置活跃模型</p>
            )}
          </CardContent>
        </Card>

        {/* 默认模型 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              默认模型
            </CardTitle>
          </CardHeader>
          <CardContent>
            {defaultModel ? (
              <div>
                <p className="font-semibold">{defaultModel.version}</p>
                <p className="text-sm text-gray-600">{defaultModel.name}</p>
                <p className="text-xs text-gray-500 mt-2">准确度: {defaultModel.avgAccuracy ?? "N/A"}%</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">未设置默认模型</p>
            )}
          </CardContent>
        </Card>

        {/* 模型总数 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              模型版本
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{models.length}</p>
            <p className="text-xs text-gray-500 mt-2">
                {models.filter((m: YAMNetModel) => !m.deprecatedAt).length} 个活跃版本
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 模型列表 */}
      <Card>
        <CardHeader>
          <CardTitle>所有模型版本</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="space-y-3">
            {models.map((model: YAMNetModel) => (
              <div
                key={model.id}
                className={cn(
                  "p-3 border rounded-lg flex items-center justify-between",
                  model.isActive ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"
                )}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{model.version}</p>
                    {model.isActive && <Badge variant="default">活跃</Badge>}
                    {model.isDefault && <Badge variant="secondary">默认</Badge>}
                    {model.deprecatedAt && <Badge variant="destructive">已弃用</Badge>}
                  </div>
                  <p className="text-sm text-gray-600">{model.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    推理时间: {model.avgProcessingTime ?? "N/A"}ms | 准确度: {model.avgAccuracy ?? "N/A"}%
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedModelId(model.id)}
                >
                  查看详情
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
