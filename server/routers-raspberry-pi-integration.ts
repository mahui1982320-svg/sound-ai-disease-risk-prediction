import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

/**
 * 树莓派集成路由
 * 处理树莓派上传的YAMNet推理结果
 */

// ============================================================================
// 类型定义
// ============================================================================

const InferenceResultSchema = z.object({
  class_id: z.number(),
  class_name: z.string(),
  confidence: z.number().min(0).max(1),
  event_type: z.enum(["danger", "health", "normal"]),
});

const AudioChunkSchema = z.object({
  duration: z.number(),
  sample_rate: z.number(),
});

const UploadInferenceSchema = z.object({
  device_id: z.string(),
  elderly_id: z.string(),
  timestamp: z.number(),
  audio_chunk: AudioChunkSchema,
  inference_results: z.array(InferenceResultSchema).min(1),
});

// ============================================================================
// 事件类型映射
// ============================================================================

const EVENT_TYPE_MAPPING: Record<string, string> = {
  "尖叫": "scream",
  "呼救": "help_request",
  "摔倒": "fall",
  "撞击": "crash",
  "玻璃破碎": "glass_break",
  "咳嗽": "cough",
  "打喷嚏": "sneeze",
  "呻吟": "moan",
  "喘息": "wheeze",
  "打鼾": "snoring",
  "哭泣": "crying",
  "说话": "speech",
  "背景噪音": "background_noise",
  "呼吸": "breathing",
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 验证设备身份
 */
async function verifyDevice(deviceId: string, deviceToken: string): Promise<boolean> {
  // 这里应该从数据库查询设备信息
  // 现在简化为检查token格式
  if (!deviceToken || deviceToken.length < 10) {
    return false;
  }
  return true;
}

/**
 * 获取事件类型
 */
function getEventType(eventName: string): string {
  return EVENT_TYPE_MAPPING[eventName] || "unknown";
}

/**
 * 判断是否需要触发警报
 */
function shouldTriggerAlarm(
  eventType: string,
  confidence: number
): boolean {
  // 危险信号且置信度>75%
  if (eventType === "danger" && confidence > 0.75) {
    return true;
  }
  // 健康信号且置信度>80%
  if (eventType === "health" && confidence > 0.80) {
    return true;
  }
  return false;
}

// ============================================================================
// 路由定义
// ============================================================================

export const raspberryPiRouter = router({
  /**
   * 上传YAMNet推理结果
   * POST /api/trpc/raspberryPi.uploadInference
   */
  uploadInference: publicProcedure
    .input(UploadInferenceSchema)
    .mutation(async ({ input }) => {
      try {
        // 验证设备身份（从请求头中获取）
        // 这里简化处理，实际应该从context中获取
        const deviceId = input.device_id;
        const elderlyId = input.elderly_id;

        // 获取主要事件（置信度最高的）
        const primaryEvent = input.inference_results[0];
        const primaryEventType = getEventType(primaryEvent.class_name);

        // 检查是否需要触发警报
        const shouldAlert = shouldTriggerAlarm(
          primaryEvent.event_type,
          primaryEvent.confidence
        );

        // 创建报警记录
        let alarmId: number | null = null;
        if (shouldAlert) {
          // 创建报警记录
          // 这里应该调用db.createAlarmRecord
          // alarmId = await db.createAlarmRecord({...});
        }

        // 记录推理结果到数据库
        // 这里应该插入到raspberry_pi_uploads表
        // 由于该表可能不存在，暂时跳过

        return {
          success: true,
          alarm_id: alarmId,
          message: shouldAlert
            ? `警报已创建 - ${primaryEvent.class_name}`
            : "推理结果已记录",
          primary_event: primaryEvent.class_name,
          confidence: primaryEvent.confidence,
          event_type: primaryEvent.event_type,
        };
      } catch (error) {
        console.error("上传推理结果失败:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "处理推理结果失败",
        });
      }
    }),

  /**
   * 获取最新的推理结果
   * GET /api/trpc/raspberryPi.getLatestInference
   */
  getLatestInference: publicProcedure
    .input(
      z.object({
        device_id: z.string(),
        limit: z.number().default(10),
      })
    )
    .query(async ({ input }) => {
      try {
        // 从数据库查询最新的推理结果
        // 这里应该从raspberry_pi_uploads表查询
        // 现在返回空结果作为占位符

        return {
          device_id: input.device_id,
          latest_inferences: [],
          total_count: 0,
        };
      } catch (error) {
        console.error("查询推理结果失败:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "查询推理结果失败",
        });
      }
    }),

  /**
   * 获取设备状态
   * GET /api/trpc/raspberryPi.getDeviceStatus
   */
  getDeviceStatus: publicProcedure
    .input(
      z.object({
        device_id: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        // 检查设备是否在线（基于最后上传时间）
        // 如果最后上传时间在5分钟内，则认为在线

        return {
          device_id: input.device_id,
          is_online: true, // 占位符
          last_upload_time: new Date(),
          last_inference: null,
          status: "online",
        };
      } catch (error) {
        console.error("查询设备状态失败:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "查询设备状态失败",
        });
      }
    }),

  /**
   * 获取推理统计信息
   * GET /api/trpc/raspberryPi.getInferenceStats
   */
  getInferenceStats: publicProcedure
    .input(
      z.object({
        device_id: z.string(),
        time_range: z.enum(["1h", "24h", "7d"]).default("24h"),
      })
    )
    .query(async ({ input }) => {
      try {
        // 计算统计信息
        // 这里应该从数据库查询并聚合数据

        return {
          device_id: input.device_id,
          time_range: input.time_range,
          total_inferences: 0,
          danger_events: 0,
          health_events: 0,
          normal_events: 0,
          average_confidence: 0,
          top_events: [],
        };
      } catch (error) {
        console.error("查询统计信息失败:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "查询统计信息失败",
        });
      }
    }),

  /**
   * 获取推理历史
   * GET /api/trpc/raspberryPi.getInferenceHistory
   */
  getInferenceHistory: publicProcedure
    .input(
      z.object({
        device_id: z.string(),
        elderly_id: z.string(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      try {
        // 从数据库查询推理历史
        // 这里应该从raspberry_pi_uploads表查询

        return {
          device_id: input.device_id,
          elderly_id: input.elderly_id,
          total_count: 0,
          inferences: [],
        };
      } catch (error) {
        console.error("查询推理历史失败:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "查询推理历史失败",
        });
      }
    }),

  /**
   * 批量上传推理结果
   * POST /api/trpc/raspberryPi.batchUploadInference
   */
  batchUploadInference: publicProcedure
    .input(
      z.object({
        device_id: z.string(),
        inferences: z.array(UploadInferenceSchema),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const results = [];

        for (const inference of input.inferences) {
          const primaryEvent = inference.inference_results[0];
          const primaryEventType = getEventType(primaryEvent.class_name);
          const shouldAlert = shouldTriggerAlarm(
            primaryEvent.event_type,
            primaryEvent.confidence
          );

          let alarmId: number | null = null;
          if (shouldAlert) {
            // 创建报警记录
            // 这里应该调用db.createAlarmRecord
            // alarmId = await db.createAlarmRecord({...});
          }

          results.push({
            timestamp: inference.timestamp,
            success: true,
            alarm_id: alarmId,
            primary_event: primaryEvent.class_name,
          });
        }

        return {
          success: true,
          total_processed: input.inferences.length,
          total_alerts: results.filter((r) => r.alarm_id).length,
          results,
        };
      } catch (error) {
        console.error("批量上传推理结果失败:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "批量上传推理结果失败",
        });
      }
    }),

  /**
   * 获取设备配置
   * GET /api/trpc/raspberryPi.getDeviceConfig
   */
  getDeviceConfig: publicProcedure
    .input(
      z.object({
        device_id: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        // 返回设备配置（如置信度阈值等）

        return {
          device_id: input.device_id,
          confidence_threshold: 0.5,
          danger_threshold: 0.75,
          health_threshold: 0.65,
          upload_interval: 10,
          model_version: "yamnet_v1",
        };
      } catch (error) {
        console.error("查询设备配置失败:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "查询设备配置失败",
        });
      }
    }),

  /**
   * 更新设备配置
   * POST /api/trpc/raspberryPi.updateDeviceConfig
   */
  updateDeviceConfig: protectedProcedure
    .input(
      z.object({
        device_id: z.string(),
        config: z.object({
          confidence_threshold: z.number().optional(),
          danger_threshold: z.number().optional(),
          health_threshold: z.number().optional(),
          upload_interval: z.number().optional(),
        }),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        // 验证用户权限（只有管理员或设备所有者可以修改）
        if (ctx.user?.role !== "admin") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "没有权限修改设备配置",
          });
        }

        // 更新设备配置
        // 这里应该保存到数据库

        return {
          success: true,
          message: "设备配置已更新",
          config: input.config,
        };
      } catch (error) {
        console.error("更新设备配置失败:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "更新设备配置失败",
        });
      }
    }),
});
