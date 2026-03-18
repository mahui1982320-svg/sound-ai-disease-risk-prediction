import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db-devices module
vi.mock("./db-devices", () => ({
  createDevice: vi.fn().mockResolvedValue(undefined),
  getDeviceByDeviceId: vi.fn().mockResolvedValue(undefined),
  getDeviceByToken: vi.fn().mockResolvedValue(undefined),
  getAllDevices: vi.fn().mockResolvedValue([]),
  updateDevice: vi.fn().mockResolvedValue(undefined),
  deleteDevice: vi.fn().mockResolvedValue(undefined),
  updateDeviceHeartbeat: vi.fn().mockResolvedValue(undefined),
  updateDeviceOnlineStatus: vi.fn().mockResolvedValue(undefined),
  createPiEvent: vi.fn().mockResolvedValue(undefined),
  getPiEventsByDevice: vi.fn().mockResolvedValue([]),
  getPiEventsByElderly: vi.fn().mockResolvedValue([]),
  getRecentDangerEvents: vi.fn().mockResolvedValue([]),
  getAllPiEvents: vi.fn().mockResolvedValue([]),
  getPiEventStats: vi.fn().mockResolvedValue({
    totalEvents: 10,
    dangerEvents: 2,
    normalEvents: 8,
    avgProcessingTime: 150,
    recentEvents24h: 5,
    recentDangerEvents24h: 1,
    topClasses: [{ name: "Speech", count: 5 }],
  }),
}));

// Mock the storage module
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://s3.example.com/audio/test.wav", key: "audio/test.wav" }),
}));

// Mock the notification module
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock the db module
vi.mock("./db", () => ({
  createAlarmRecord: vi.fn().mockResolvedValue([{ insertId: 1 }]),
  createYAMNetInference: vi.fn().mockResolvedValue(undefined),
  getElderlyById: vi.fn().mockResolvedValue({ id: 1, name: "张奶奶" }),
  getAllElderly: vi.fn().mockResolvedValue([]),
  getAllAlarmRecords: vi.fn().mockResolvedValue([]),
  getAllAlarmRecordsWithElderly: vi.fn().mockResolvedValue([]),
  getAlarmRecordById: vi.fn().mockResolvedValue(null),
  getYAMNetInferenceByAlarmId: vi.fn().mockResolvedValue(null),
  getYAMNetInferenceStats: vi.fn().mockResolvedValue({}),
  updateAlarmRecord: vi.fn().mockResolvedValue(undefined),
  createReviewLog: vi.fn().mockResolvedValue(undefined),
  createElderly: vi.fn().mockResolvedValue(undefined),
  updateElderly: vi.fn().mockResolvedValue(undefined),
  deleteElderly: vi.fn().mockResolvedValue(undefined),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
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

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

const dbDevices = await import("./db-devices");

describe("raspberryPi router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("registerDevice", () => {
    it("registers a new device and returns an API token", async () => {
      vi.mocked(dbDevices.getDeviceByDeviceId).mockResolvedValueOnce(undefined);
      vi.mocked(dbDevices.createDevice).mockResolvedValueOnce(undefined as any);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.raspberryPi.registerDevice({
        deviceId: "rpi-test-001",
        deviceName: "测试设备",
        elderlyId: 1,
        location: "测试房间",
      });

      expect(result.success).toBe(true);
      expect(result.deviceId).toBe("rpi-test-001");
      expect(result.apiToken).toBeTruthy();
      expect(result.apiToken.length).toBe(64); // 32 bytes hex = 64 chars
      expect(dbDevices.createDevice).toHaveBeenCalledOnce();
    });

    it("rejects duplicate device ID", async () => {
      vi.mocked(dbDevices.getDeviceByDeviceId).mockResolvedValueOnce({
        id: 1,
        deviceId: "rpi-test-001",
        deviceName: "已存在设备",
        deviceType: "raspberry_pi",
        elderlyId: null,
        apiToken: "existing-token",
        confidenceThreshold: 0.5,
        dangerThreshold: 0.75,
        rmsThreshold: 0.03,
        isOnline: false,
        lastHeartbeat: null,
        lastEventTime: null,
        firmwareVersion: null,
        modelVersion: null,
        location: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.raspberryPi.registerDevice({
          deviceId: "rpi-test-001",
          deviceName: "重复设备",
        })
      ).rejects.toThrow();
    });
  });

  describe("heartbeat", () => {
    it("accepts heartbeat from authenticated device", async () => {
      vi.mocked(dbDevices.getDeviceByDeviceId).mockResolvedValueOnce({
        id: 1,
        deviceId: "rpi-001",
        deviceName: "测试设备",
        deviceType: "raspberry_pi",
        elderlyId: 1,
        apiToken: "valid-token-123",
        confidenceThreshold: 0.5,
        dangerThreshold: 0.75,
        rmsThreshold: 0.03,
        isOnline: true,
        lastHeartbeat: new Date(),
        lastEventTime: null,
        firmwareVersion: null,
        modelVersion: "yamnet_v1",
        location: "301室",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.raspberryPi.heartbeat({
        device_id: "rpi-001",
        api_token: "valid-token-123",
        status: { model_version: "yamnet_v1", cpu_temp: 45.2 },
      });

      expect(result.success).toBe(true);
      expect(result.server_time).toBeTruthy();
      expect(result.config).toBeDefined();
      expect(result.config.confidence_threshold).toBe(0.5);
      expect(dbDevices.updateDevice).toHaveBeenCalledOnce();
    });

    it("rejects heartbeat with invalid token", async () => {
      vi.mocked(dbDevices.getDeviceByDeviceId).mockResolvedValueOnce({
        id: 1,
        deviceId: "rpi-001",
        deviceName: "测试设备",
        deviceType: "raspberry_pi",
        elderlyId: 1,
        apiToken: "valid-token-123",
        confidenceThreshold: 0.5,
        dangerThreshold: 0.75,
        rmsThreshold: 0.03,
        isOnline: true,
        lastHeartbeat: new Date(),
        lastEventTime: null,
        firmwareVersion: null,
        modelVersion: null,
        location: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.raspberryPi.heartbeat({
          device_id: "rpi-001",
          api_token: "wrong-token",
        })
      ).rejects.toThrow();
    });
  });

  describe("uploadEvent", () => {
    it("uploads a normal event without creating alarm", async () => {
      vi.mocked(dbDevices.getDeviceByDeviceId).mockResolvedValueOnce({
        id: 1,
        deviceId: "rpi-001",
        deviceName: "测试设备",
        deviceType: "raspberry_pi",
        elderlyId: 1,
        apiToken: "valid-token-123",
        confidenceThreshold: 0.5,
        dangerThreshold: 0.75,
        rmsThreshold: 0.03,
        isOnline: true,
        lastHeartbeat: new Date(),
        lastEventTime: null,
        firmwareVersion: null,
        modelVersion: "yamnet_v1",
        location: "301室",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.raspberryPi.uploadEvent({
        device_id: "rpi-001",
        api_token: "valid-token-123",
        timestamp: Date.now(),
        primary_class_id: 0, // Speech
        primary_class_name: "Speech",
        primary_confidence: 0.85,
        is_danger: false,
        top_labels: [
          { class_id: 0, class_name: "Speech", confidence: 0.85 },
          { class_id: 1, class_name: "Music", confidence: 0.1 },
        ],
        rms_volume: 0.05,
        processing_time_ms: 120,
        model_version: "yamnet_v1",
      });

      expect(result.success).toBe(true);
      expect(result.alarm_created).toBe(false);
      expect(result.danger_level).toBe("none");
      expect(dbDevices.createPiEvent).toHaveBeenCalledOnce();
    });

    it("uploads a danger event and creates alarm", async () => {
      const dbModule = await import("./db");
      vi.mocked(dbModule.createAlarmRecord).mockResolvedValueOnce([{ insertId: 42 }] as any);

      vi.mocked(dbDevices.getDeviceByDeviceId).mockResolvedValueOnce({
        id: 1,
        deviceId: "rpi-001",
        deviceName: "测试设备",
        deviceType: "raspberry_pi",
        elderlyId: 1,
        apiToken: "valid-token-123",
        confidenceThreshold: 0.5,
        dangerThreshold: 0.75,
        rmsThreshold: 0.03,
        isOnline: true,
        lastHeartbeat: new Date(),
        lastEventTime: null,
        firmwareVersion: null,
        modelVersion: "yamnet_v1",
        location: "301室",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const ctx = createPublicContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.raspberryPi.uploadEvent({
        device_id: "rpi-001",
        api_token: "valid-token-123",
        timestamp: Date.now(),
        primary_class_id: 6, // Screaming (danger)
        primary_class_name: "Screaming",
        primary_confidence: 0.9,
        is_danger: true,
        top_labels: [
          { class_id: 6, class_name: "Screaming", confidence: 0.9 },
          { class_id: 7, class_name: "Shout", confidence: 0.05 },
        ],
        rms_volume: 0.15,
        processing_time_ms: 130,
        model_version: "yamnet_v1",
      });

      expect(result.success).toBe(true);
      expect(result.alarm_created).toBe(true);
      expect(result.danger_level).toBe("critical");
      expect(dbDevices.createPiEvent).toHaveBeenCalledOnce();
      expect(dbModule.createAlarmRecord).toHaveBeenCalledOnce();
    });
  });

  describe("listDevices", () => {
    it("returns device list for authenticated user", async () => {
      vi.mocked(dbDevices.getAllDevices).mockResolvedValueOnce([
        {
          id: 1,
          deviceId: "rpi-001",
          deviceName: "测试设备1",
          deviceType: "raspberry_pi",
          elderlyId: 1,
          apiToken: "token-1",
          confidenceThreshold: 0.5,
          dangerThreshold: 0.75,
          rmsThreshold: 0.03,
          isOnline: true,
          lastHeartbeat: new Date(),
          lastEventTime: null,
          firmwareVersion: null,
          modelVersion: "yamnet_v1",
          location: "301室",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.raspberryPi.listDevices();
      expect(result).toHaveLength(1);
      expect(result[0].deviceId).toBe("rpi-001");
    });
  });

  describe("eventStats", () => {
    it("returns event statistics", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      const result = await caller.raspberryPi.eventStats({});
      expect(result).toBeDefined();
      expect(result?.totalEvents).toBe(10);
      expect(result?.dangerEvents).toBe(2);
    });
  });
});
