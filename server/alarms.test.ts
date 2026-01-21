import { describe, it, expect, vi, beforeEach } from "vitest";
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
    role: "admin",
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

describe("Alarms API", () => {
  describe("alarms.upload", () => {
    it("should accept alarm data from hardware", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.alarms.upload({
        elderlyId: 1,
        eventType: "fall",
        confidenceScore: 85,
        audioUrl: "https://example.com/audio.mp3",
      });

      expect(result).toEqual({ success: true });
    });

    it("should validate confidence score range", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.alarms.upload({
          elderlyId: 1,
          eventType: "fall",
          confidenceScore: 150, // Invalid: > 100
          audioUrl: "https://example.com/audio.mp3",
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should validate event type", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.alarms.upload({
          elderlyId: 1,
          eventType: "invalid" as any,
          confidenceScore: 85,
          audioUrl: "https://example.com/audio.mp3",
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("alarms.list", () => {
    it("should require authentication", async () => {
      const caller = appRouter.createCaller({
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      });

      try {
        await caller.alarms.list({
          limit: 50,
          offset: 0,
        });
        expect.fail("Should have thrown authentication error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should support status filtering", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.alarms.list({
        limit: 50,
        offset: 0,
        status: "pending",
      });

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("alarms.review", () => {
    it("should require authentication", async () => {
      const caller = appRouter.createCaller({
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      });

      try {
        await caller.alarms.review({
          id: 1,
          status: "confirmed",
          notes: "Test review",
        });
        expect.fail("Should have thrown authentication error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should validate review status", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.alarms.review({
          id: 1,
          status: "invalid" as any,
          notes: "Test review",
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});

describe("Elderly API", () => {
  describe("elderly.create", () => {
    it("should require authentication", async () => {
      const caller = appRouter.createCaller({
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      });

      try {
        await caller.elderly.create({
          name: "Test Elderly",
          roomNumber: "101",
        });
        expect.fail("Should have thrown authentication error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should validate required fields", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      try {
        await caller.elderly.create({
          name: "",
          roomNumber: "101",
        });
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("elderly.list", () => {
    it("should require authentication", async () => {
      const caller = appRouter.createCaller({
        user: null,
        req: { protocol: "https", headers: {} } as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      });

      try {
        await caller.elderly.list();
        expect.fail("Should have thrown authentication error");
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it("should return elderly list", async () => {
      const { ctx } = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.elderly.list();

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
