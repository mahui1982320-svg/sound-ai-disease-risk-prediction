import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, elderly, InsertElderly, alarmRecords, InsertAlarmRecord, reviewLogs, InsertReviewLog } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

/**
 * 老人档案查询函数
 */
export async function getElderlyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(elderly).where(eq(elderly.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllElderly() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(elderly).orderBy(elderly.name);
}

export async function createElderly(data: InsertElderly) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(elderly).values(data);
  return result;
}

export async function updateElderly(id: number, data: Partial<InsertElderly>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(elderly).set(data).where(eq(elderly.id, id));
}

export async function deleteElderly(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(elderly).where(eq(elderly.id, id));
}

/**
 * 报警记录查询函数
 */
export async function getAlarmRecordById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(alarmRecords).where(eq(alarmRecords.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAlarmRecordsByElderly(elderlyId: number, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(alarmRecords)
    .where(eq(alarmRecords.elderlyId, elderlyId))
    .orderBy(desc(alarmRecords.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getAllAlarmRecords(limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(alarmRecords)
    .orderBy(desc(alarmRecords.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function getAlarmRecordsByStatus(status: string, limit = 50, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(alarmRecords)
    .where(eq(alarmRecords.reviewStatus, status as any))
    .orderBy(desc(alarmRecords.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function createAlarmRecord(data: InsertAlarmRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(alarmRecords).values(data);
  return { success: true };
}

export async function updateAlarmRecord(id: number, data: Partial<InsertAlarmRecord>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(alarmRecords).set(data).where(eq(alarmRecords.id, id));
}

/**
 * 复核日志查询函数
 */
export async function createReviewLog(data: InsertReviewLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return await db.insert(reviewLogs).values(data);
}

export async function getReviewLogsByAlarmRecord(alarmRecordId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db
    .select()
    .from(reviewLogs)
    .where(eq(reviewLogs.alarmRecordId, alarmRecordId))
    .orderBy(desc(reviewLogs.createdAt));
}
