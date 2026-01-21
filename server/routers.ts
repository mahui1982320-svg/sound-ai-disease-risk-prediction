import { z } from "zod";
import * as db from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure } from "./_core/trpc";
import { publicProcedure, router } from "./_core/trpc"; // protectedProcedure is now imported above

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  /**
   * 老人档案管理 API
   */
  elderly: router({
    list: protectedProcedure.query(async () => {
      return await db.getAllElderly();
    }),
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getElderlyById(input.id);
    }),
    create: protectedProcedure
      .input(
        z.object({
          name: z.string(),
          roomNumber: z.string(),
          emergencyContact: z.string().optional(),
          emergencyPhone: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await db.createElderly(input);
      }),
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          roomNumber: z.string().optional(),
          emergencyContact: z.string().optional(),
          emergencyPhone: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateElderly(id, data);
        return { success: true };
      }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      await db.deleteElderly(input.id);
      return { success: true };
    }),
  }),

  /**
   * 报警记录 API
   */
  alarms: router({
    /**
     * 硬件端上传报警数据的公开接口（无需认证）
     */
    upload: publicProcedure
      .input(
        z.object({
          elderlyId: z.number(),
          eventType: z.enum(["fall", "scream", "cough", "moan"]),
          confidenceScore: z.number().int().min(0).max(100),
          audioUrl: z.string().url(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await db.createAlarmRecord({
          elderlyId: input.elderlyId,
          eventType: input.eventType,
          confidenceScore: input.confidenceScore,
          audioUrl: input.audioUrl,
          reviewStatus: "pending",
        });
        // TODO: 触发实时通知推送
        return { success: true };
      }),

    /**
     * 查询报警记录（分页）
     */
    list: protectedProcedure
      .input(
        z.object({
          limit: z.number().default(50),
          offset: z.number().default(0),
          status: z.enum(["pending", "confirmed", "falseAlarm"]).optional(),
          elderlyId: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        let records;
        if (input.elderlyId) {
          records = await db.getAlarmRecordsByElderly(input.elderlyId, input.limit, input.offset);
        } else if (input.status) {
          records = await db.getAlarmRecordsByStatus(input.status, input.limit, input.offset);
        } else {
          records = await db.getAllAlarmRecords(input.limit, input.offset);
        }
        return records;
      }),

    /**
     * 查询单个报警记录
     */
    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getAlarmRecordById(input.id);
    }),

    /**
     * 报警复核（确认危险或误报）
     */
    review: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["confirmed", "falseAlarm"]),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await db.updateAlarmRecord(input.id, {
          reviewStatus: input.status,
          reviewedBy: ctx.user.id,
          reviewedAt: new Date(),
          reviewNotes: input.notes,
        });
        // 记录复核日志
        await db.createReviewLog({
          alarmRecordId: input.id,
          userId: ctx.user.id,
          action: input.status,
          notes: input.notes,
        });
        return { success: true };
      }),
  }),

  /**
   * 数据统计 API
   */
  stats: router({
    /**
     * 获取报警统计数据
     */
    summary: protectedProcedure.query(async () => {
      // TODO: 实现详细的统计查询
      return {
        totalAlarms: 0,
        pendingAlarms: 0,
        confirmedAlarms: 0,
        falseAlarmCount: 0,
        falseAlarmRate: 0,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
