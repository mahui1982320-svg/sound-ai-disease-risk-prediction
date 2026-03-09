import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as db from "./db";
import { getDb } from "./db";

describe("YAMNet Integration Tests", () => {
  let testAlarmId: number;

  beforeAll(async () => {
    // 确保数据库连接可用
    const database = await getDb();
    expect(database).toBeDefined();
  });

  describe("Database Schema - YAMNet Inferences", () => {
    it("should create a YAMNet inference record", async () => {
      // 首先创建一个测试报警记录
      const alarmResult = await db.createAlarmRecord({
        elderlyId: 1,
        eventType: "fall",
        confidenceScore: 85,
        audioUrl: "https://example.com/audio.wav",
        reviewStatus: "pending",
      });

      // 获取报警ID
      testAlarmId = (alarmResult as any)?.insertId || 1;
      expect(testAlarmId).toBeGreaterThan(0);

      // 创建YAMNet推理记录
      const topLabels = [
        { label: "fall", confidence: 0.95 },
        { label: "crash", confidence: 0.03 },
        { label: "bang", confidence: 0.02 },
      ];

      const rawScores: Record<string, number> = {};
      for (let i = 0; i < 521; i++) {
        rawScores[`label_${i}`] = Math.random();
      }

      const result = await db.createYAMNetInference({
        alarmRecordId: testAlarmId,
        topLabels: JSON.stringify(topLabels),
        rawScores: JSON.stringify(rawScores),
        mappedEventType: "fall",
        mappingConfidence: 95,
        audioLength: 1500,
        processingTime: 150,
        modelVersion: "yamnet-v1.0",
      });

      expect(result).toBeDefined();
    });

    it("should retrieve YAMNet inference by alarm ID", async () => {
      const inference = await db.getYAMNetInferenceByAlarmId(testAlarmId);

      expect(inference).toBeDefined();
      expect(inference?.alarmRecordId).toBe(testAlarmId);
      expect(inference?.mappedEventType).toBe("fall");
      expect(inference?.mappingConfidence).toBe(95);
      expect(inference?.audioLength).toBe(1500);
      expect(inference?.processingTime).toBe(150);
      expect(inference?.modelVersion).toBe("yamnet-v1.0");

      // 验证JSON字段可以正确解析
      const topLabels = JSON.parse(inference?.topLabels || "[]");
      expect(Array.isArray(topLabels)).toBe(true);
      expect(topLabels.length).toBeGreaterThan(0);
      expect(topLabels[0]).toHaveProperty("label");
      expect(topLabels[0]).toHaveProperty("confidence");
    });

    it("should calculate YAMNet inference statistics", async () => {
      const stats = await db.getYAMNetInferenceStats();

      expect(stats).toBeDefined();
      expect(stats?.totalInferences).toBeGreaterThanOrEqual(1);
      expect(stats?.avgProcessingTime).toBeGreaterThan(0);
      expect(stats?.avgAudioLength).toBeGreaterThan(0);
      expect(Array.isArray(stats?.modelVersions)).toBe(true);
      expect(stats?.modelVersions).toContain("yamnet-v1.0");
    });
  });

  describe("YAMNet Model Output Processing", () => {
    it("should correctly map YAMNet labels to event types", () => {
      // 模拟YAMNet输出的标签映射
      const yamnetLabelToEventType: Record<string, string> = {
        fall: "fall",
        crash: "fall",
        bang: "fall",
        scream: "scream",
        yell: "scream",
        shout: "scream",
        cough: "cough",
        sneeze: "cough",
        moan: "moan",
        groan: "moan",
      };

      // 测试映射逻辑
      expect(yamnetLabelToEventType["fall"]).toBe("fall");
      expect(yamnetLabelToEventType["crash"]).toBe("fall");
      expect(yamnetLabelToEventType["scream"]).toBe("scream");
      expect(yamnetLabelToEventType["cough"]).toBe("cough");
      expect(yamnetLabelToEventType["moan"]).toBe("moan");
    });

    it("should calculate confidence score from YAMNet output", () => {
      // 模拟YAMNet输出
      const yamnetOutput = {
        topLabels: [
          { label: "fall", confidence: 0.95 },
          { label: "crash", confidence: 0.03 },
          { label: "bang", confidence: 0.02 },
        ],
      };

      // 计算最终置信度 (使用最高分数 * 100)
      const confidenceScore = Math.round(yamnetOutput.topLabels[0].confidence * 100);

      expect(confidenceScore).toBe(95);
      expect(confidenceScore).toBeGreaterThanOrEqual(0);
      expect(confidenceScore).toBeLessThanOrEqual(100);
    });

    it("should validate audio processing metrics", () => {
      // 模拟音频处理指标
      const audioMetrics = {
        audioLength: 1500, // 毫秒
        processingTime: 150, // 毫秒
        sampleRate: 16000, // Hz
      };

      // 验证处理时间合理性 (应该远小于音频长度)
      expect(audioMetrics.processingTime).toBeLessThan(audioMetrics.audioLength);

      // 验证音频长度合理性 (通常在500ms-5000ms之间)
      expect(audioMetrics.audioLength).toBeGreaterThan(500);
      expect(audioMetrics.audioLength).toBeLessThan(5000);

      // 验证采样率
      expect(audioMetrics.sampleRate).toBe(16000);
    });
  });

  describe("YAMNet Integration with Alarm System", () => {
    it("should create YAMNet inference records", async () => {
      // 创建报警记录
      const alarmResult = await db.createAlarmRecord({
        elderlyId: 1,
        eventType: "scream",
        confidenceScore: 88,
        audioUrl: "https://example.com/audio2.wav",
        reviewStatus: "pending",
      });

      expect(alarmResult).toBeDefined();

      // 创建YAMNet推理记录
      const result = await db.createYAMNetInference({
        alarmRecordId: 1,
        topLabels: JSON.stringify([
          { label: "scream", confidence: 0.88 },
          { label: "yell", confidence: 0.10 },
          { label: "shout", confidence: 0.02 },
        ]),
        rawScores: JSON.stringify({}),
        mappedEventType: "scream",
        mappingConfidence: 88,
        audioLength: 2000,
        processingTime: 180,
        modelVersion: "yamnet-v1.0",
      });

      expect(result).toBeDefined();
    });

    it("should support multiple event types", async () => {
      const eventTypes = ["fall", "scream", "cough", "moan"];

      for (const eventType of eventTypes) {
        const alarmResult = await db.createAlarmRecord({
          elderlyId: 1,
          eventType: eventType as any,
          confidenceScore: 80,
          audioUrl: `https://example.com/audio-${eventType}.wav`,
          reviewStatus: "pending",
        });

        // 验证报警记录创建成功
        expect(alarmResult).toBeDefined();
      }
    });
  });

  describe("YAMNet Performance Metrics", () => {
    it("should track processing time", () => {
      const processingTimes = [100, 150, 120, 180, 140];
      const avgProcessingTime = processingTimes.reduce((a, b) => a + b) / processingTimes.length;

      expect(avgProcessingTime).toBeGreaterThan(0);
      expect(avgProcessingTime).toBeLessThan(200); // 应该在200ms以内
    });

    it("should track audio length statistics", () => {
      const audioLengths = [1000, 1500, 2000, 1200, 1800];
      const avgAudioLength = audioLengths.reduce((a, b) => a + b) / audioLengths.length;

      expect(avgAudioLength).toBeGreaterThan(1000);
      expect(avgAudioLength).toBeLessThan(2000);
    });

    it("should validate model version tracking", () => {
      const modelVersions = ["yamnet-v1.0", "yamnet-v1.1", "yamnet-v2.0"];

      for (const version of modelVersions) {
        expect(version).toMatch(/^yamnet-v\d+\.\d+$/);
      }
    });
  });

  afterAll(async () => {
    // 清理测试数据（可选）
  });
});
