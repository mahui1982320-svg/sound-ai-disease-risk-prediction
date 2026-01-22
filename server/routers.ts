import { z } from "zod";
import * as db from "./db";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure } from "./_core/trpc";
import { publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
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
          address: z.string().optional(),
          healthStatus: z.string().optional(),
          carerName: z.string().optional(),
          carerPhone: z.string().optional(),
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
          address: z.string().optional(),
          healthStatus: z.string().optional(),
          carerName: z.string().optional(),
          carerPhone: z.string().optional(),
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
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteElderly(input.id);
        return { success: true };
      }),
  }),

  alarms: router({
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
        return { success: true };
      }),

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
        const records = await db.getAllAlarmRecordsWithElderly(input.limit, input.offset);
        let filtered = records;
        if (input.elderlyId) {
          filtered = records.filter(r => r.alarm.elderlyId === input.elderlyId);
        }
        if (input.status) {
          filtered = filtered.filter(r => r.alarm.reviewStatus === input.status);
        }
        return filtered;
      }),

    get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getAlarmRecordById(input.id);
    }),

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
        await db.createReviewLog({
          alarmRecordId: input.id,
          userId: ctx.user.id,
          action: input.status,
          notes: input.notes,
        });
        return { success: true };
      }),

    stats: protectedProcedure.query(async () => {
      const allRecords = await db.getAllAlarmRecords(1000, 0);
      const confirmed = allRecords.filter(r => r.reviewStatus === "confirmed").length;
      const falseAlarms = allRecords.filter(r => r.reviewStatus === "falseAlarm").length;
      const pending = allRecords.filter(r => r.reviewStatus === "pending").length;
      
      const eventTypes = {
        fall: allRecords.filter(r => r.eventType === "fall").length,
        scream: allRecords.filter(r => r.eventType === "scream").length,
        cough: allRecords.filter(r => r.eventType === "cough").length,
        moan: allRecords.filter(r => r.eventType === "moan").length,
      };

      return {
        total: allRecords.length,
        confirmed,
        falseAlarms,
        pending,
        falseAlarmRate: allRecords.length > 0 ? (falseAlarms / allRecords.length * 100).toFixed(2) : 0,
        eventTypes,
      };
    }),
  }),
});

export type AppRouter = typeof appRouter;
