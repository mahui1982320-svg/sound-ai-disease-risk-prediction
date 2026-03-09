import { z } from "zod";
import { router, protectedProcedure } from "./_core/trpc";
import * as dbModels from "./db-yamnet-models";

export const yamnetModelsRouter = router({
  // 获取所有模型
  listModels: protectedProcedure.query(async () => {
    return await dbModels.getAllYAMNetModels();
  }),

  // 获取活跃模型
  getActiveModel: protectedProcedure.query(async () => {
    return await dbModels.getActiveYAMNetModel();
  }),

  // 获取默认模型
  getDefaultModel: protectedProcedure.query(async () => {
    return await dbModels.getDefaultYAMNetModel();
  }),

  // 获取指定版本的模型
  getModelByVersion: protectedProcedure
    .input(z.object({ version: z.string() }))
    .query(async ({ input }) => {
      return await dbModels.getYAMNetModelByVersion(input.version);
    }),

  // 创建新模型版本
  createModel: protectedProcedure
    .input(
      z.object({
        version: z.string(),
        name: z.string(),
        description: z.string().optional(),
        modelPath: z.string(),
        checksumHash: z.string().optional(),
        avgProcessingTime: z.number().optional(),
        avgAccuracy: z.number().optional(),
        supportedLabels: z.number().optional(),
        releaseNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return await dbModels.createYAMNetModel(input);
    }),

  // 更新模型信息
  updateModel: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        avgProcessingTime: z.number().optional(),
        avgAccuracy: z.number().optional(),
        releaseNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return await dbModels.updateYAMNetModel(id, data);
    }),

  // 激活模型
  activateModel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await dbModels.activateYAMNetModel(input.id);
    }),

  // 设置默认模型
  setDefaultModel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await dbModels.setDefaultYAMNetModel(input.id);
    }),

  // 弃用模型
  deprecateModel: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      return await dbModels.deprecateYAMNetModel(input.id);
    }),

  // 获取模型对比结果
  getModelComparisons: protectedProcedure
    .input(z.object({ alarmId: z.number() }))
    .query(async ({ input }) => {
      return await dbModels.getModelComparisonsByAlarmId(input.alarmId);
    }),

  // 获取两个模型的对比统计
  getComparisonStats: protectedProcedure
    .input(
      z.object({
        baselineModelId: z.number(),
        compareModelId: z.number(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      return await dbModels.getModelComparisonStats(
        input.baselineModelId,
        input.compareModelId,
        input.startDate,
        input.endDate
      );
    }),

  // 获取模型统计数据
  getModelStats: protectedProcedure
    .input(z.object({ modelId: z.number() }))
    .query(async ({ input }) => {
      return await dbModels.getModelStats(input.modelId);
    }),
});
