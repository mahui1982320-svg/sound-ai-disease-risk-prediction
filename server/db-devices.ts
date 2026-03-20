import { eq, desc, and, gte, sql } from "drizzle-orm";
import { getDb } from "./db";
import { devices, piEvents, InsertDevice, InsertPiEvent } from "../drizzle/schema";

// ============================================================================
// 设备管理
// ============================================================================

export async function createDevice(data: InsertDevice) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(devices).values(data);
}

export async function getDeviceByDeviceId(deviceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(devices).where(eq(devices.deviceId, deviceId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDeviceByToken(apiToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(devices).where(eq(devices.apiToken, apiToken)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllDevices() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(devices).orderBy(desc(devices.updatedAt));
}

export async function updateDevice(deviceId: string, data: Partial<InsertDevice>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(devices).set(data).where(eq(devices.deviceId, deviceId));
}

export async function deleteDevice(deviceId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(devices).where(eq(devices.deviceId, deviceId));
}

export async function updateDeviceHeartbeat(deviceId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(devices).set({
    isOnline: true,
    lastHeartbeat: new Date(),
  }).where(eq(devices.deviceId, deviceId));
}

export async function updateDeviceOnlineStatus() {
  const db = await getDb();
  if (!db) return;
  // 超过2分钟没有心跳的设备标记为离线
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  await db.update(devices).set({ isOnline: false })
    .where(and(
      eq(devices.isOnline, true),
      sql`${devices.lastHeartbeat} < ${twoMinutesAgo}`
    ));
}

// ============================================================================
// 树莓派事件
// ============================================================================

export async function createPiEvent(data: InsertPiEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(piEvents).values(data);
  return result;
}

export async function getPiEventsByDevice(deviceId: string, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(piEvents)
    .where(eq(piEvents.deviceId, deviceId))
    .orderBy(desc(piEvents.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getPiEventsByElderly(elderlyId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(piEvents)
    .where(eq(piEvents.elderlyId, elderlyId))
    .orderBy(desc(piEvents.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getRecentDangerEvents(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(piEvents)
    .where(eq(piEvents.isDanger, true))
    .orderBy(desc(piEvents.createdAt))
    .limit(limit);
}

export async function getAllPiEvents(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(piEvents)
    .orderBy(desc(piEvents.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getPiEventStats(deviceId?: string) {
  const db = await getDb();
  if (!db) return null;

  const whereClause = deviceId ? eq(piEvents.deviceId, deviceId) : undefined;

  const allEvents = whereClause
    ? await db.select().from(piEvents).where(whereClause)
    : await db.select().from(piEvents);

  const dangerEvents = allEvents.filter(e => e.isDanger);
  const totalProcessingTime = allEvents.reduce((sum, e) => sum + (e.processingTimeMs || 0), 0);

  // 最近24小时的事件
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentEvents = allEvents.filter(e => new Date(e.createdAt) > oneDayAgo);
  const recentDangerEvents = recentEvents.filter(e => e.isDanger);

  // 按类别统计
  const classCounts: Record<string, number> = {};
  allEvents.forEach(e => {
    classCounts[e.primaryClassName] = (classCounts[e.primaryClassName] || 0) + 1;
  });
  const topClasses = Object.entries(classCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  return {
    totalEvents: allEvents.length,
    dangerEvents: dangerEvents.length,
    normalEvents: allEvents.length - dangerEvents.length,
    avgProcessingTime: allEvents.length > 0 ? Math.round(totalProcessingTime / allEvents.length) : 0,
    recentEvents24h: recentEvents.length,
    recentDangerEvents24h: recentDangerEvents.length,
    topClasses,
  };
}
