import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("Enhanced Alarms API", () => {
  it("should upload alarm with elderly ID", async () => {
    const caller = appRouter.createCaller({} as any);

    const result = await caller.alarms.upload({
      elderlyId: 1,
      eventType: "fall",
      confidenceScore: 85,
      audioUrl: "https://example.com/audio.mp3",
    });

    expect(result).toEqual({ success: true });
  });

  it("should validate confidence score range", async () => {
    const caller = appRouter.createCaller({} as any);

    try {
      await caller.alarms.upload({
        elderlyId: 1,
        eventType: "fall",
        confidenceScore: 150,
        audioUrl: "https://example.com/audio.mp3",
      });
      expect.fail("Should have thrown error");
    } catch (error: any) {
      expect(error.message).toContain("too_big");
    }
  });

  it("should validate event type", async () => {
    const caller = appRouter.createCaller({} as any);

    try {
      await caller.alarms.upload({
        elderlyId: 1,
        eventType: "invalid" as any,
        confidenceScore: 85,
        audioUrl: "https://example.com/audio.mp3",
      });
      expect.fail("Should have thrown error");
    } catch (error: any) {
      expect(error.message).toContain("invalid_value");
    }
  });

  it("should create elderly with all details", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.elderly.create({
      name: "张大爷",
      roomNumber: "101",
      address: "北京市朝阳区某小区",
      healthStatus: "腰椎间盘突出，行动困难",
      carerName: "王护理",
      carerPhone: "13800138000",
      emergencyContact: "张女儿",
      emergencyPhone: "13800138001",
      notes: "需要特别照顾",
    });

    expect(result).toBeDefined();
  });

  it("should list alarms with elderly information", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.alarms.list({
      limit: 10,
      offset: 0,
    });

    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("alarm");
      expect(result[0]).toHaveProperty("elderly");
      expect(result[0].alarm).toHaveProperty("eventType");
      expect(result[0].alarm).toHaveProperty("confidenceScore");
    }
  });

  it("should filter alarms by status", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.alarms.list({
      limit: 50,
      offset: 0,
      status: "pending",
    });

    expect(Array.isArray(result)).toBe(true);
    result.forEach((record) => {
      expect(record.alarm.reviewStatus).toBe("pending");
    });
  });

  it("should review alarm with notes", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.alarms.review({
      id: 1,
      status: "confirmed",
      notes: "确认为真实摔倒事件",
    });

    expect(result).toEqual({ success: true });
  });

  it("should get alarm statistics", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const stats = await caller.alarms.stats();

    expect(stats).toHaveProperty("total");
    expect(stats).toHaveProperty("confirmed");
    expect(stats).toHaveProperty("falseAlarms");
    expect(stats).toHaveProperty("pending");
    expect(stats).toHaveProperty("falseAlarmRate");
    expect(stats).toHaveProperty("eventTypes");
    
    expect(typeof stats.total).toBe("number");
    expect(typeof stats.falseAlarmRate).toBe("string");
    expect(stats.eventTypes).toHaveProperty("fall");
    expect(stats.eventTypes).toHaveProperty("scream");
    expect(stats.eventTypes).toHaveProperty("cough");
    expect(stats.eventTypes).toHaveProperty("moan");
  });

  it("should handle empty alarm list", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.alarms.list({
      limit: 50,
      offset: 1000,
    });

    expect(Array.isArray(result)).toBe(true);
  });
});
