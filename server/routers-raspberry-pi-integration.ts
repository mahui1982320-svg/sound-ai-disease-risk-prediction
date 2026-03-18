import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import * as dbDevices from "./db-devices";
import { storagePut } from "./storage";
import { notifyOwner } from "./_core/notification";
import { TRPCError } from "@trpc/server";
import crypto from "crypto";

/**
 * 树莓派集成路由
 * 处理树莓派上传的YAMNet推理结果和音频文件
 */

// ============================================================================
// YAMNet 危险事件类别映射
// ============================================================================

const DANGER_CLASS_IDS = new Set([
  6, 7, 9, 11, 19, 20, 22, 33, 39, 42,
  300, 301, 310, 315, 316, 317, 390, 393, 394, 399, 420,
]);

const CLASS_TO_EVENT_TYPE: Record<number, "fall" | "scream" | "cough" | "moan"> = {
  6: "scream", 7: "scream", 9: "scream", 11: "scream",
  19: "scream", 20: "scream", 22: "scream",
  33: "cough", 39: "cough", 42: "cough",
  300: "fall", 301: "fall", 310: "fall", 315: "fall", 316: "fall",
  317: "moan", 390: "moan", 393: "moan", 394: "moan", 399: "moan",
  420: "scream",
};

function getDangerLevel(classId: number, confidence: number): "none" | "low" | "medium" | "high" | "critical" {
  if (!DANGER_CLASS_IDS.has(classId)) return "none";
  if (confidence >= 0.85) return "critical";
  if (confidence >= 0.70) return "high";
  if (confidence >= 0.55) return "medium";
  return "low";
}

function getMappedEventType(classId: number): "fall" | "scream" | "cough" | "moan" {
  return CLASS_TO_EVENT_TYPE[classId] || "moan";
}

// ============================================================================
// 路由定义
// ============================================================================

export const raspberryPiRouter = router({
  // ========================================================================
  // 设备管理 API (需要登录)
  // ========================================================================

  registerDevice: protectedProcedure
    .input(z.object({
      deviceId: z.string().min(1).max(64),
      deviceName: z.string().min(1).max(100),
      elderlyId: z.number().optional(),
      location: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const existing = await dbDevices.getDeviceByDeviceId(input.deviceId);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `设备ID "${input.deviceId}" 已存在`,
        });
      }

      const apiToken = crypto.randomBytes(32).toString("hex");

      await dbDevices.createDevice({
        deviceId: input.deviceId,
        deviceName: input.deviceName,
        deviceType: "raspberry_pi",
        elderlyId: input.elderlyId ?? null,
        apiToken,
        confidenceThreshold: 0.5,
        dangerThreshold: 0.75,
        rmsThreshold: 0.03,
        isOnline: false,
        location: input.location ?? null,
      });

      return {
        success: true,
        deviceId: input.deviceId,
        apiToken,
        message: "设备注册成功，请保存API Token",
      };
    }),

  listDevices: protectedProcedure.query(async () => {
    await dbDevices.updateDeviceOnlineStatus();
    return await dbDevices.getAllDevices();
  }),

  getDevice: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ input }) => {
      const device = await dbDevices.getDeviceByDeviceId(input.deviceId);
      if (!device) {
        throw new TRPCError({ code: "NOT_FOUND", message: "设备不存在" });
      }
      return device;
    }),

  updateDeviceConfig: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
      deviceName: z.string().optional(),
      elderlyId: z.number().nullable().optional(),
      location: z.string().optional(),
      confidenceThreshold: z.number().min(0).max(1).optional(),
      dangerThreshold: z.number().min(0).max(1).optional(),
      rmsThreshold: z.number().min(0).max(1).optional(),
    }))
    .mutation(async ({ input }) => {
      const { deviceId, ...data } = input;
      const device = await dbDevices.getDeviceByDeviceId(deviceId);
      if (!device) {
        throw new TRPCError({ code: "NOT_FOUND", message: "设备不存在" });
      }

      const updateData: Record<string, unknown> = {};
      if (data.deviceName !== undefined) updateData.deviceName = data.deviceName;
      if (data.elderlyId !== undefined) updateData.elderlyId = data.elderlyId;
      if (data.location !== undefined) updateData.location = data.location;
      if (data.confidenceThreshold !== undefined) updateData.confidenceThreshold = data.confidenceThreshold;
      if (data.dangerThreshold !== undefined) updateData.dangerThreshold = data.dangerThreshold;
      if (data.rmsThreshold !== undefined) updateData.rmsThreshold = data.rmsThreshold;

      await dbDevices.updateDevice(deviceId, updateData as any);
      return { success: true };
    }),

  deleteDevice: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .mutation(async ({ input }) => {
      await dbDevices.deleteDevice(input.deviceId);
      return { success: true };
    }),

  regenerateToken: protectedProcedure
    .input(z.object({ deviceId: z.string() }))
    .mutation(async ({ input }) => {
      const device = await dbDevices.getDeviceByDeviceId(input.deviceId);
      if (!device) {
        throw new TRPCError({ code: "NOT_FOUND", message: "设备不存在" });
      }
      const newToken = crypto.randomBytes(32).toString("hex");
      await dbDevices.updateDevice(input.deviceId, { apiToken: newToken });
      return { success: true, apiToken: newToken };
    }),

  // ========================================================================
  // 树莓派端 API (使用设备Token认证)
  // ========================================================================

  heartbeat: publicProcedure
    .input(z.object({
      device_id: z.string(),
      api_token: z.string(),
      status: z.object({
        cpu_temp: z.number().optional(),
        cpu_usage: z.number().optional(),
        memory_usage: z.number().optional(),
        uptime: z.number().optional(),
        model_version: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const device = await dbDevices.getDeviceByDeviceId(input.device_id);
      if (!device || device.apiToken !== input.api_token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "设备认证失败" });
      }

      const updateData: Record<string, unknown> = {
        isOnline: true,
        lastHeartbeat: new Date(),
      };
      if (input.status?.model_version) {
        updateData.modelVersion = input.status.model_version;
      }
      await dbDevices.updateDevice(input.device_id, updateData as any);

      return {
        success: true,
        server_time: Date.now(),
        config: {
          confidence_threshold: device.confidenceThreshold,
          danger_threshold: device.dangerThreshold,
          rms_threshold: device.rmsThreshold,
        },
      };
    }),

  uploadEvent: publicProcedure
    .input(z.object({
      device_id: z.string(),
      api_token: z.string(),
      timestamp: z.number(),
      primary_class_id: z.number().int().min(0).max(520),
      primary_class_name: z.string(),
      primary_confidence: z.number().min(0).max(1),
      is_danger: z.boolean(),
      top_labels: z.array(z.object({
        class_id: z.number(),
        class_name: z.string(),
        confidence: z.number(),
      })).optional(),
      rms_volume: z.number().optional(),
      processing_time_ms: z.number().optional(),
      model_version: z.string().optional(),
      audio_base64: z.string().optional(),
      audio_duration: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const device = await dbDevices.getDeviceByDeviceId(input.device_id);
      if (!device || device.apiToken !== input.api_token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "设备认证失败" });
      }

      // 上传音频到S3
      let audioUrl: string | null = null;
      if (input.audio_base64) {
        try {
          const audioBuffer = Buffer.from(input.audio_base64, "base64");
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          const randomSuffix = crypto.randomBytes(4).toString("hex");
          const fileKey = `audio/${input.device_id}/${timestamp}-${randomSuffix}.wav`;
          const result = await storagePut(fileKey, audioBuffer, "audio/wav");
          audioUrl = result.url;
        } catch (err) {
          console.error("音频上传S3失败:", err);
        }
      }

      const dangerLevel = getDangerLevel(input.primary_class_id, input.primary_confidence);

      // 如果是危险事件，创建报警记录
      let alarmRecordId: number | null = null;
      if (input.is_danger && input.primary_confidence >= device.dangerThreshold) {
        const eventType = getMappedEventType(input.primary_class_id);
        const confidenceScore = Math.round(input.primary_confidence * 100);

        try {
          const alarmResult = await db.createAlarmRecord({
            elderlyId: device.elderlyId || 0,
            eventType,
            confidenceScore,
            audioUrl: audioUrl || "no-audio",
            reviewStatus: "pending",
          });

          alarmRecordId = (alarmResult as any)[0]?.insertId || null;

          if (alarmRecordId && input.top_labels) {
            await db.createYAMNetInference({
              alarmRecordId,
              topLabels: JSON.stringify(input.top_labels),
              rawScores: "{}",
              mappedEventType: eventType,
              mappingConfidence: confidenceScore,
              audioLength: input.audio_duration ? Math.round(input.audio_duration * 1000) : null,
              processingTime: input.processing_time_ms || null,
              modelVersion: input.model_version || "yamnet_v1",
            });
          }

          // 发送通知
          try {
            const elderlyInfo = device.elderlyId
              ? await db.getElderlyById(device.elderlyId)
              : null;
            const elderlyName = elderlyInfo?.name || "未知老人";
            const eventLabels: Record<string, string> = {
              fall: "摔倒", scream: "尖叫", cough: "咳嗽", moan: "呻吟",
            };

            await notifyOwner({
              title: `[危险警报] ${elderlyName} - ${eventLabels[eventType] || eventType}`,
              content: `设备 ${device.deviceName} 检测到危险事件\n类型: ${input.primary_class_name}\n置信度: ${confidenceScore}%\n时间: ${new Date().toLocaleString("zh-CN")}`,
            });
          } catch (notifyErr) {
            console.error("发送通知失败:", notifyErr);
          }
        } catch (alarmErr) {
          console.error("创建报警记录失败:", alarmErr);
        }
      }

      // 记录事件
      await dbDevices.createPiEvent({
        deviceId: input.device_id,
        elderlyId: device.elderlyId,
        primaryClassName: input.primary_class_name,
        primaryClassId: input.primary_class_id,
        primaryConfidence: input.primary_confidence,
        isDanger: input.is_danger,
        dangerLevel,
        topLabels: input.top_labels ? JSON.stringify(input.top_labels) : null,
        audioUrl,
        audioDuration: input.audio_duration || null,
        rmsVolume: input.rms_volume || null,
        processingTimeMs: input.processing_time_ms || null,
        modelVersion: input.model_version || null,
        alarmRecordId,
        deviceTimestamp: new Date(input.timestamp),
      });

      await dbDevices.updateDevice(input.device_id, {
        lastEventTime: new Date(),
        modelVersion: input.model_version || undefined,
      } as any);

      return {
        success: true,
        alarm_created: alarmRecordId !== null,
        alarm_id: alarmRecordId,
        danger_level: dangerLevel,
        audio_url: audioUrl,
        server_time: Date.now(),
      };
    }),

  getConfig: publicProcedure
    .input(z.object({
      device_id: z.string(),
      api_token: z.string(),
    }))
    .query(async ({ input }) => {
      const device = await dbDevices.getDeviceByDeviceId(input.device_id);
      if (!device || device.apiToken !== input.api_token) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "设备认证失败" });
      }

      return {
        device_id: device.deviceId,
        device_name: device.deviceName,
        elderly_id: device.elderlyId,
        confidence_threshold: device.confidenceThreshold,
        danger_threshold: device.dangerThreshold,
        rms_threshold: device.rmsThreshold,
        model_version: device.modelVersion,
      };
    }),

  // ========================================================================
  // 事件查询 API (需要登录)
  // ========================================================================

  listEvents: protectedProcedure
    .input(z.object({
      deviceId: z.string().optional(),
      elderlyId: z.number().optional(),
      dangerOnly: z.boolean().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      let events;
      if (input.deviceId) {
        events = await dbDevices.getPiEventsByDevice(input.deviceId, input.limit, input.offset);
      } else if (input.elderlyId) {
        events = await dbDevices.getPiEventsByElderly(input.elderlyId, input.limit, input.offset);
      } else {
        events = await dbDevices.getAllPiEvents(input.limit, input.offset);
      }

      if (input.dangerOnly) {
        events = events.filter(e => e.isDanger);
      }

      return events;
    }),

  recentDangerEvents: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async ({ input }) => {
      return await dbDevices.getRecentDangerEvents(input.limit);
    }),

  eventStats: protectedProcedure
    .input(z.object({ deviceId: z.string().optional() }))
    .query(async ({ input }) => {
      return await dbDevices.getPiEventStats(input.deviceId);
    }),

  getDeviceStatus: protectedProcedure
    .input(z.object({ device_id: z.string() }))
    .query(async ({ input }) => {
      await dbDevices.updateDeviceOnlineStatus();
      const device = await dbDevices.getDeviceByDeviceId(input.device_id);
      if (!device) {
        throw new TRPCError({ code: "NOT_FOUND", message: "设备不存在" });
      }

      const recentEvents = await dbDevices.getPiEventsByDevice(input.device_id, 5, 0);

      return {
        device_id: device.deviceId,
        device_name: device.deviceName,
        is_online: device.isOnline,
        last_heartbeat: device.lastHeartbeat,
        last_event_time: device.lastEventTime,
        model_version: device.modelVersion,
        recent_events: recentEvents,
      };
    }),

  // 保留旧API兼容性
  uploadInference: publicProcedure
    .input(z.object({
      device_id: z.string(),
      elderly_id: z.string(),
      timestamp: z.number(),
      audio_chunk: z.object({ duration: z.number(), sample_rate: z.number() }),
      inference_results: z.array(z.object({
        class_id: z.number(),
        class_name: z.string(),
        confidence: z.number().min(0).max(1),
        event_type: z.enum(["danger", "health", "normal"]),
      })).min(1),
    }))
    .mutation(async ({ input }) => {
      const primaryEvent = input.inference_results[0];
      return {
        success: true,
        alarm_id: null,
        message: `推理结果已记录 - ${primaryEvent.class_name}`,
        primary_event: primaryEvent.class_name,
        confidence: primaryEvent.confidence,
        event_type: primaryEvent.event_type,
      };
    }),

  getLatestInference: publicProcedure
    .input(z.object({ device_id: z.string(), limit: z.number().default(10) }))
    .query(async ({ input }) => {
      const events = await dbDevices.getPiEventsByDevice(input.device_id, input.limit, 0);
      return { device_id: input.device_id, latest_inferences: events, total_count: events.length };
    }),

  getInferenceStats: publicProcedure
    .input(z.object({ device_id: z.string(), time_range: z.enum(["1h", "24h", "7d"]).default("24h") }))
    .query(async ({ input }) => {
      const stats = await dbDevices.getPiEventStats(input.device_id);
      return { device_id: input.device_id, time_range: input.time_range, ...(stats || { totalEvents: 0, dangerEvents: 0, normalEvents: 0, avgProcessingTime: 0, recentEvents24h: 0, recentDangerEvents24h: 0, topClasses: [] }) };
    }),

  getInferenceHistory: publicProcedure
    .input(z.object({ device_id: z.string(), elderly_id: z.string(), limit: z.number().default(50), offset: z.number().default(0) }))
    .query(async ({ input }) => {
      const events = await dbDevices.getPiEventsByDevice(input.device_id, input.limit, input.offset);
      return { device_id: input.device_id, elderly_id: input.elderly_id, total_count: events.length, inferences: events };
    }),

  batchUploadInference: publicProcedure
    .input(z.object({
      device_id: z.string(),
      inferences: z.array(z.object({
        device_id: z.string(),
        elderly_id: z.string(),
        timestamp: z.number(),
        audio_chunk: z.object({ duration: z.number(), sample_rate: z.number() }),
        inference_results: z.array(z.object({
          class_id: z.number(),
          class_name: z.string(),
          confidence: z.number().min(0).max(1),
          event_type: z.enum(["danger", "health", "normal"]),
        })).min(1),
      })),
    }))
    .mutation(async ({ input }) => {
      return { success: true, total_processed: input.inferences.length, total_alerts: 0, results: [] };
    }),

  getDeviceConfig: publicProcedure
    .input(z.object({ device_id: z.string() }))
    .query(async ({ input }) => {
      const device = await dbDevices.getDeviceByDeviceId(input.device_id);
      return {
        device_id: input.device_id,
        confidence_threshold: device?.confidenceThreshold ?? 0.5,
        danger_threshold: device?.dangerThreshold ?? 0.75,
        health_threshold: 0.65,
        upload_interval: 10,
        model_version: device?.modelVersion ?? "yamnet_v1",
      };
    }),
});
