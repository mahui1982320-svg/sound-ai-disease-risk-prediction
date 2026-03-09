import { mysqlTable, int, varchar, text, timestamp, mysqlEnum, boolean } from "drizzle-orm/mysql-core";

/**
 * YAMNet模型版本表：管理系统中使用的不同YAMNet模型版本
 * 支持模型的注册、启用/禁用、性能指标追踪
 */
export const yamnetModels = mysqlTable("yamnet_models", {
  id: int("id").autoincrement().primaryKey(),
  
  // 模型基本信息
  version: varchar("version", { length: 50 }).notNull().unique(), // 如 "v1.0", "v1.1", "v2.0"
  name: varchar("name", { length: 100 }).notNull(), // 如 "YAMNet Base", "YAMNet Optimized"
  description: text("description"), // 模型描述
  
  // 模型配置
  modelPath: varchar("model_path", { length: 255 }).notNull(), // 模型文件路径或URL
  checksumHash: varchar("checksum_hash", { length: 64 }), // 模型文件校验和
  
  // 性能指标
  avgProcessingTime: int("avg_processing_time"), // 平均推理时间 (毫秒)
  avgAccuracy: int("avg_accuracy"), // 平均准确度 (0-100)
  supportedLabels: int("supported_labels").notNull().default(521), // 支持的标签数量
  
  // 状态管理
  isActive: boolean("is_active").default(false).notNull(), // 是否为当前活跃模型
  isDefault: boolean("is_default").default(false).notNull(), // 是否为默认模型
  
  // 元数据
  releaseNotes: text("release_notes"), // 发布说明
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deprecatedAt: timestamp("deprecated_at"), // 弃用时间
});

export type YAMNetModel = typeof yamnetModels.$inferSelect;
export type InsertYAMNetModel = typeof yamnetModels.$inferInsert;

/**
 * 模型性能对比表：记录不同模型在相同音频上的推理结果
 * 用于对比分析不同模型的性能差异
 */
export const yamnetModelComparisons = mysqlTable("yamnet_model_comparisons", {
  id: int("id").autoincrement().primaryKey(),
  
  // 关联信息
  alarmRecordId: int("alarm_record_id").notNull(), // 原始报警记录
  baselineModelId: int("baseline_model_id").notNull(), // 基准模型
  compareModelId: int("compare_model_id").notNull(), // 对比模型
  
  // 基准模型结果
  baselineEventType: varchar("baseline_event_type", { length: 20 }),
  baselineConfidence: int("baseline_confidence"), // 0-100
  baselineProcessingTime: int("baseline_processing_time"), // 毫秒
  
  // 对比模型结果
  compareEventType: varchar("compare_event_type", { length: 20 }),
  compareConfidence: int("compare_confidence"), // 0-100
  compareProcessingTime: int("compare_processing_time"), // 毫秒
  
  // 对比分析
  confidenceDiff: int("confidence_diff"), // 置信度差异
  processingTimeDiff: int("processing_time_diff"), // 处理时间差异 (毫秒)
  isConsistent: boolean("is_consistent"), // 两个模型的结果是否一致
  
  // 元数据
  notes: text("notes"), // 对比备注
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type YAMNetModelComparison = typeof yamnetModelComparisons.$inferSelect;
export type InsertYAMNetModelComparison = typeof yamnetModelComparisons.$inferInsert;

/**
 * 模型使用统计表：追踪每个模型的使用情况和性能
 */
export const yamnetModelStats = mysqlTable("yamnet_model_stats", {
  id: int("id").autoincrement().primaryKey(),
  
  // 模型关联
  modelId: int("model_id").notNull(),
  
  // 统计数据
  totalInferences: int("total_inferences").default(0).notNull(), // 总推理次数
  avgProcessingTime: int("avg_processing_time"), // 平均推理时间
  avgConfidence: int("avg_confidence"), // 平均置信度
  
  // 事件类型统计
  fallCount: int("fall_count").default(0), // 摔倒识别数
  screamCount: int("scream_count").default(0), // 尖叫识别数
  coughCount: int("cough_count").default(0), // 咳嗽识别数
  moanCount: int("moan_count").default(0), // 呻吟识别数
  
  // 准确度相关
  highConfidenceCount: int("high_confidence_count").default(0), // 高置信度 (>=80%)
  mediumConfidenceCount: int("medium_confidence_count").default(0), // 中置信度 (60-80%)
  lowConfidenceCount: int("low_confidence_count").default(0), // 低置信度 (<60%)
  
  // 时间范围
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  
  // 元数据
  lastUpdated: timestamp("last_updated").defaultNow().onUpdateNow().notNull(),
});

export type YAMNetModelStats = typeof yamnetModelStats.$inferSelect;
export type InsertYAMNetModelStats = typeof yamnetModelStats.$inferInsert;
