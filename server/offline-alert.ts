/**
 * 设备离线告警模块
 * 定时检查设备心跳，超过 2 分钟无心跳的设备发送离线通知
 */
import { notifyOwner } from "./_core/notification";
import * as dbDevices from "./db-devices";

const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 分钟
const CHECK_INTERVAL_MS = 60 * 1000; // 每 60 秒检查一次
const NOTIFY_COOLDOWN_MS = 30 * 60 * 1000; // 同一设备 30 分钟内不重复通知

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export async function checkDeviceOffline() {
  try {
    const allDevices = await dbDevices.getAllDevices();
    const now = Date.now();

    for (const device of allDevices) {
      if (!device.lastHeartbeat) continue; // 从未连接过的设备不告警

      const lastHeartbeatMs = new Date(device.lastHeartbeat).getTime();
      const offlineDuration = now - lastHeartbeatMs;

      // 设备超过 2 分钟没有心跳
      if (offlineDuration > OFFLINE_THRESHOLD_MS) {
        // 检查是否需要标记为离线
        if (device.isOnline) {
          await dbDevices.updateDevice(device.deviceId, { isOnline: false } as any);
        }

        // 检查通知冷却期：避免重复发送
        const lastNotified = device.lastOfflineNotifiedAt
          ? new Date(device.lastOfflineNotifiedAt).getTime()
          : 0;

        if (now - lastNotified > NOTIFY_COOLDOWN_MS) {
          const offlineMinutes = Math.round(offlineDuration / 60000);
          const lastHeartbeatStr = new Date(device.lastHeartbeat).toLocaleString("zh-CN", {
            timeZone: "Asia/Shanghai",
          });

          try {
            await notifyOwner({
              title: `[设备离线] ${device.deviceName} 已断开连接`,
              content: [
                `设备名称: ${device.deviceName}`,
                `设备ID: ${device.deviceId}`,
                `离线时长: ${offlineMinutes} 分钟`,
                `最后心跳: ${lastHeartbeatStr}`,
                `安装位置: ${device.location || "未设置"}`,
                "",
                "请检查设备电源和网络连接。",
              ].join("\n"),
            });

            // 更新通知时间
            await dbDevices.updateDevice(device.deviceId, {
              lastOfflineNotifiedAt: new Date(),
            } as any);

            console.log(`[OfflineAlert] 已发送离线通知: ${device.deviceName} (${device.deviceId})`);
          } catch (err) {
            console.error(`[OfflineAlert] 发送离线通知失败: ${device.deviceId}`, err);
          }
        }
      }
    }
  } catch (err) {
    console.error("[OfflineAlert] 检查设备离线状态失败:", err);
  }
}

export function startOfflineAlertScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
  }

  console.log("[OfflineAlert] 设备离线告警已启动，检查间隔: 60秒，离线阈值: 2分钟");

  // 启动后延迟 30 秒进行第一次检查（等待数据库连接就绪）
  setTimeout(() => {
    checkDeviceOffline();
  }, 30000);

  intervalHandle = setInterval(checkDeviceOffline, CHECK_INTERVAL_MS);
}

export function stopOfflineAlertScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[OfflineAlert] 设备离线告警已停止");
  }
}
