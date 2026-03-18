import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * 老人档案表：存储养老院老人的基本信息
 */
export const elderly = mysqlTable("elderly", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  roomNumber: varchar("roomNumber", { length: 50 }).notNull(),
  address: varchar("address", { length: 255 }),
  healthStatus: text("health_status"),
  carerName: varchar("carer_name", { length: 100 }),
  carerPhone: varchar("carer_phone", { length: 20 }),
  emergencyContact: varchar("emergencyContact", { length: 100 }),
  emergencyPhone: varchar("emergencyPhone", { length: 20 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Elderly = typeof elderly.$inferSelect;
export type InsertElderly = typeof elderly.$inferInsert;

/**
 * 报警记录表：存储硬件端上传的报警数据
 * 事件类型：fall(摔倒)、scream(尖叫)、cough(咳嗽)、moan(呻吟)
 * 复核状态：pending(待复核)、confirmed(已确认)、falseAlarm(误报)
 */
export const alarmRecords = mysqlTable("alarm_records", {
  id: int("id").autoincrement().primaryKey(),
  elderlyId: int("elderly_id").notNull(),
  eventType: mysqlEnum("event_type", ["fall", "scream", "cough", "moan"]).notNull(),
  confidenceScore: int("confidence_score").notNull(), // 0-100
  audioUrl: text("audio_url").notNull(),
  reviewStatus: mysqlEnum("review_status", ["pending", "confirmed", "falseAlarm"]).default("pending").notNull(),
  reviewedBy: int("reviewed_by"), // user id
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AlarmRecord = typeof alarmRecords.$inferSelect;
export type InsertAlarmRecord = typeof alarmRecords.$inferInsert;

/**
 * 复核日志表：记录所有复核操作的历史
 */
export const reviewLogs = mysqlTable("review_logs", {
  id: int("id").autoincrement().primaryKey(),
  alarmRecordId: int("alarm_record_id").notNull(),
  userId: int("user_id").notNull(),
  action: mysqlEnum("action", ["confirmed", "falseAlarm"]).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReviewLog = typeof reviewLogs.$inferSelect;
export type InsertReviewLog = typeof reviewLogs.$inferInsert;

/**
 * YAMNet推理结果表：存储YAMNet模型的推理详情
 * 用于分析模型的准确度和性能
 */
export const yamnetInferences = mysqlTable("yamnet_inferences", {
  id: int("id").autoincrement().primaryKey(),
  alarmRecordId: int("alarm_record_id").notNull(),
  
  // 原始YAMNet输出 (JSON格式)
  topLabels: text("top_labels").notNull(), // [{label, confidence}, ...]
  rawScores: text("raw_scores").notNull(), // 完整的521个标签分数
  
  // 处理结果
  mappedEventType: mysqlEnum("mapped_event_type", ["fall", "scream", "cough", "moan"]),
  mappingConfidence: int("mapping_confidence"), // 0-100
  
  // 处理元数据
  audioLength: int("audio_length"), // 毫秒
  processingTime: int("processing_time"), // 毫秒
  modelVersion: varchar("model_version", { length: 50 }), // YAMNet版本
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type YAMNetInference = typeof yamnetInferences.$inferSelect;
export type InsertYAMNetInference = typeof yamnetInferences.$inferInsert;

// 导入YAMNet模型管理相关表
export { yamnetModels, yamnetModelComparisons, yamnetModelStats } from "./schema_yamnet_models";
export type { YAMNetModel, InsertYAMNetModel, YAMNetModelComparison, InsertYAMNetModelComparison, YAMNetModelStats, InsertYAMNetModelStats } from "./schema_yamnet_models";

// 导入设备管理和树莓派事件表
export { devices, piEvents } from "./schema_devices";
export type { Device, InsertDevice, PiEvent, InsertPiEvent } from "./schema_devices";