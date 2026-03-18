import { mysqlTable, int, varchar, text, timestamp, mysqlEnum, boolean, float } from "drizzle-orm/mysql-core";

/**
 * 设备管理表：管理树莓派等硬件设备
 * 每个设备绑定一个老人，负责监听该老人的声音
 */
export const devices = mysqlTable("devices", {
  id: int("id").autoincrement().primaryKey(),

  // 设备标识
  deviceId: varchar("device_id", { length: 64 }).notNull().unique(), // 设备唯一ID (如 "rpi-001")
  deviceName: varchar("device_name", { length: 100 }).notNull(), // 设备名称 (如 "张奶奶房间树莓派")
  deviceType: varchar("device_type", { length: 50 }).default("raspberry_pi").notNull(), // 设备类型

  // 绑定关系
  elderlyId: int("elderly_id"), // 绑定的老人ID

  // 设备配置
  apiToken: varchar("api_token", { length: 128 }).notNull(), // 设备认证token
  confidenceThreshold: float("confidence_threshold").default(0.5).notNull(), // 置信度阈值
  dangerThreshold: float("danger_threshold").default(0.75).notNull(), // 危险事件阈值
  rmsThreshold: float("rms_threshold").default(0.03).notNull(), // RMS音量阈值

  // 状态信息
  isOnline: boolean("is_online").default(false).notNull(),
  lastHeartbeat: timestamp("last_heartbeat"),
  lastEventTime: timestamp("last_event_time"),
  firmwareVersion: varchar("firmware_version", { length: 50 }),
  modelVersion: varchar("model_version", { length: 50 }),

  // 位置信息
  location: varchar("location", { length: 255 }), // 安装位置描述

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Device = typeof devices.$inferSelect;
export type InsertDevice = typeof devices.$inferInsert;

/**
 * 树莓派事件上传表：记录树莓派上传的每一次声音事件
 * 包含YAMNet推理结果、音频URL、是否触发报警等
 */
export const piEvents = mysqlTable("pi_events", {
  id: int("id").autoincrement().primaryKey(),

  // 设备和老人关联
  deviceId: varchar("device_id", { length: 64 }).notNull(),
  elderlyId: int("elderly_id"),

  // YAMNet推理结果
  primaryClassName: varchar("primary_class_name", { length: 100 }).notNull(), // 主要识别类别名
  primaryClassId: int("primary_class_id").notNull(), // YAMNet类别ID (0-520)
  primaryConfidence: float("primary_confidence").notNull(), // 主要类别置信度 (0-1)

  // 危险事件信息
  isDanger: boolean("is_danger").default(false).notNull(), // 是否为危险事件
  dangerLevel: mysqlEnum("danger_level", ["none", "low", "medium", "high", "critical"]).default("none").notNull(),

  // Top-5 标签 (JSON格式)
  topLabels: text("top_labels"), // [{class_id, class_name, confidence}, ...]

  // 音频信息
  audioUrl: text("audio_url"), // S3音频文件URL
  audioDuration: float("audio_duration"), // 音频时长(秒)
  rmsVolume: float("rms_volume"), // RMS音量值

  // 处理信息
  processingTimeMs: int("processing_time_ms"), // 推理耗时(毫秒)
  modelVersion: varchar("model_version", { length: 50 }),

  // 是否已创建报警记录
  alarmRecordId: int("alarm_record_id"), // 关联的报警记录ID (如果触发了报警)

  // 设备端时间戳
  deviceTimestamp: timestamp("device_timestamp"), // 设备端记录的时间

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PiEvent = typeof piEvents.$inferSelect;
export type InsertPiEvent = typeof piEvents.$inferInsert;
