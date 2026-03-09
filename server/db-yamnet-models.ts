import {
  yamnetModels,
  yamnetModelComparisons,
  yamnetModelStats,
  type YAMNetModel,
  type InsertYAMNetModel,
  type YAMNetModelComparison,
  type InsertYAMNetModelComparison,
  type YAMNetModelStats,
} from "../drizzle/schema_yamnet_models";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { getDb } from "./db";

/**
 * 获取所有YAMNet模型版本
 */
export async function getAllYAMNetModels(): Promise<YAMNetModel[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(yamnetModels).orderBy(desc(yamnetModels.createdAt));
}

/**
 * 获取活跃的YAMNet模型
 */
export async function getActiveYAMNetModel(): Promise<YAMNetModel | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(yamnetModels)
    .where(eq(yamnetModels.isActive, true))
    .limit(1);
  return result[0] || null;
}

/**
 * 获取默认YAMNet模型
 */
export async function getDefaultYAMNetModel(): Promise<YAMNetModel | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(yamnetModels)
    .where(eq(yamnetModels.isDefault, true))
    .limit(1);
  return result[0] || null;
}

/**
 * 获取指定版本的YAMNet模型
 */
export async function getYAMNetModelByVersion(version: string): Promise<YAMNetModel | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db
    .select()
    .from(yamnetModels)
    .where(eq(yamnetModels.version, version))
    .limit(1);
  return result[0] || null;
}

/**
 * 创建新的YAMNet模型版本
 */
export async function createYAMNetModel(data: InsertYAMNetModel): Promise<YAMNetModel | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(yamnetModels).values(data);
  const id = result[0].insertId;
  
  const model = await db
    .select()
    .from(yamnetModels)
    .where(eq(yamnetModels.id, Number(id)))
    .limit(1);
  
  return model[0] || null;
}

/**
 * 更新YAMNet模型信息
 */
export async function updateYAMNetModel(
  id: number,
  data: Partial<InsertYAMNetModel>
): Promise<YAMNetModel | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(yamnetModels).set(data).where(eq(yamnetModels.id, id));
  
  const result = await db
    .select()
    .from(yamnetModels)
    .where(eq(yamnetModels.id, id))
    .limit(1);
  
  return result[0] || null;
}

/**
 * 激活指定的YAMNet模型（同时禁用其他模型）
 */
export async function activateYAMNetModel(id: number): Promise<YAMNetModel | null> {
  const db = await getDb();
  if (!db) return null;
  
  // 禁用所有其他模型
  await db.update(yamnetModels).set({ isActive: false }).where(eq(yamnetModels.isActive, true));
  
  // 激活指定模型
  await db.update(yamnetModels).set({ isActive: true }).where(eq(yamnetModels.id, id));
  
  const result = await db
    .select()
    .from(yamnetModels)
    .where(eq(yamnetModels.id, id))
    .limit(1);
  
  return result[0] || null;
}

/**
 * 设置默认YAMNet模型
 */
export async function setDefaultYAMNetModel(id: number): Promise<YAMNetModel | null> {
  const db = await getDb();
  if (!db) return null;
  
  // 取消其他模型的默认状态
  await db.update(yamnetModels).set({ isDefault: false }).where(eq(yamnetModels.isDefault, true));
  
  // 设置指定模型为默认
  await db.update(yamnetModels).set({ isDefault: true }).where(eq(yamnetModels.id, id));
  
  const result = await db
    .select()
    .from(yamnetModels)
    .where(eq(yamnetModels.id, id))
    .limit(1);
  
  return result[0] || null;
}

/**
 * 弃用YAMNet模型
 */
export async function deprecateYAMNetModel(id: number): Promise<YAMNetModel | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db
    .update(yamnetModels)
    .set({ deprecatedAt: new Date(), isActive: false })
    .where(eq(yamnetModels.id, id));
  
  const result = await db
    .select()
    .from(yamnetModels)
    .where(eq(yamnetModels.id, id))
    .limit(1);
  
  return result[0] || null;
}

/**
 * 创建模型对比记录
 */
export async function createModelComparison(
  data: InsertYAMNetModelComparison
): Promise<YAMNetModelComparison | null> {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.insert(yamnetModelComparisons).values(data);
  const id = result[0].insertId;
  
  const comparison = await db
    .select()
    .from(yamnetModelComparisons)
    .where(eq(yamnetModelComparisons.id, Number(id)))
    .limit(1);
  
  return comparison[0] || null;
}

/**
 * 获取指定报警记录的模型对比结果
 */
export async function getModelComparisonsByAlarmId(alarmId: number): Promise<YAMNetModelComparison[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(yamnetModelComparisons)
    .where(eq(yamnetModelComparisons.alarmRecordId, alarmId))
    .orderBy(desc(yamnetModelComparisons.createdAt));
}

/**
 * 获取两个模型之间的对比统计
 */
export async function getModelComparisonStats(
  baselineModelId: number,
  compareModelId: number,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalComparisons: number;
  consistentCount: number;
  inconsistentCount: number;
  avgConfidenceDiff: number;
  avgProcessingTimeDiff: number;
}> {
  const db = await getDb();
  if (!db) {
    return {
      totalComparisons: 0,
      consistentCount: 0,
      inconsistentCount: 0,
      avgConfidenceDiff: 0,
      avgProcessingTimeDiff: 0,
    };
  }
  
  let whereCondition = and(
    eq(yamnetModelComparisons.baselineModelId, baselineModelId),
    eq(yamnetModelComparisons.compareModelId, compareModelId)
  );
  
  if (startDate && endDate) {
    whereCondition = and(
      whereCondition,
      gte(yamnetModelComparisons.createdAt, startDate),
      lte(yamnetModelComparisons.createdAt, endDate)
    );
  }
  
  const comparisons = await db
    .select()
    .from(yamnetModelComparisons)
    .where(whereCondition);
  
  if (comparisons.length === 0) {
    return {
      totalComparisons: 0,
      consistentCount: 0,
      inconsistentCount: 0,
      avgConfidenceDiff: 0,
      avgProcessingTimeDiff: 0,
    };
  }
  
  const consistentCount = comparisons.filter((c: YAMNetModelComparison) => c.isConsistent).length;
  const inconsistentCount = comparisons.length - consistentCount;
  
  const avgConfidenceDiff =
    comparisons.reduce((sum: number, c: YAMNetModelComparison) => sum + (c.confidenceDiff || 0), 0) / comparisons.length;
  
  const avgProcessingTimeDiff =
    comparisons.reduce((sum: number, c: YAMNetModelComparison) => sum + (c.processingTimeDiff || 0), 0) / comparisons.length;
  
  return {
    totalComparisons: comparisons.length,
    consistentCount,
    inconsistentCount,
    avgConfidenceDiff: Math.round(avgConfidenceDiff),
    avgProcessingTimeDiff: Math.round(avgProcessingTimeDiff),
  };
}

/**
 * 获取或创建模型统计记录
 */
export async function getOrCreateModelStats(
  modelId: number,
  periodStart: Date,
  periodEnd: Date
): Promise<YAMNetModelStats | null> {
  const db = await getDb();
  if (!db) return null;
  
  const existing = await db
    .select()
    .from(yamnetModelStats)
    .where(
      and(
        eq(yamnetModelStats.modelId, modelId),
        eq(yamnetModelStats.periodStart, periodStart),
        eq(yamnetModelStats.periodEnd, periodEnd)
      )
    );
  
  if (existing && existing.length > 0) {
    return existing[0];
  }
  
  const result = await db.insert(yamnetModelStats).values({
    modelId,
    periodStart,
    periodEnd,
    totalInferences: 0,
    fallCount: 0,
    screamCount: 0,
    coughCount: 0,
    moanCount: 0,
    highConfidenceCount: 0,
    mediumConfidenceCount: 0,
    lowConfidenceCount: 0,
  });
  
  const id = result[0].insertId;
  
  const stats = await db
    .select()
    .from(yamnetModelStats)
    .where(eq(yamnetModelStats.id, Number(id)))
    .limit(1);
  
  return stats[0] || null;
}

/**
 * 更新模型统计数据
 */
export async function updateModelStats(
  id: number,
  data: Partial<YAMNetModelStats>
): Promise<YAMNetModelStats | null> {
  const db = await getDb();
  if (!db) return null;
  
  await db.update(yamnetModelStats).set(data).where(eq(yamnetModelStats.id, id));
  
  const result = await db
    .select()
    .from(yamnetModelStats)
    .where(eq(yamnetModelStats.id, id))
    .limit(1);
  
  return result[0] || null;
}

/**
 * 获取模型的统计数据
 */
export async function getModelStats(modelId: number): Promise<YAMNetModelStats[]> {
  const db = await getDb();
  if (!db) return [];
  
  return await db
    .select()
    .from(yamnetModelStats)
    .where(eq(yamnetModelStats.modelId, modelId))
    .orderBy(desc(yamnetModelStats.periodStart));
}
