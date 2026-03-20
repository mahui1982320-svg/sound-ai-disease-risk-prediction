import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the notification module
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

// Mock the db-devices module
vi.mock("./db-devices", () => ({
  getAllDevices: vi.fn(),
  updateDevice: vi.fn().mockResolvedValue(undefined),
}));

import { checkDeviceOffline } from "./offline-alert";
import { notifyOwner } from "./_core/notification";
import * as dbDevices from "./db-devices";

describe("offline-alert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should not alert for devices with recent heartbeat", async () => {
    const mockDevices = [
      {
        id: 1,
        deviceId: "rpi-001",
        deviceName: "测试设备",
        isOnline: true,
        lastHeartbeat: new Date(), // just now
        lastOfflineNotifiedAt: null,
        location: "301室",
      },
    ];
    vi.mocked(dbDevices.getAllDevices).mockResolvedValue(mockDevices as any);

    await checkDeviceOffline();

    expect(notifyOwner).not.toHaveBeenCalled();
    expect(dbDevices.updateDevice).not.toHaveBeenCalled();
  });

  it("should alert for devices offline > 2 minutes", async () => {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const mockDevices = [
      {
        id: 1,
        deviceId: "rpi-001",
        deviceName: "测试设备",
        isOnline: true,
        lastHeartbeat: threeMinutesAgo,
        lastOfflineNotifiedAt: null,
        location: "301室",
      },
    ];
    vi.mocked(dbDevices.getAllDevices).mockResolvedValue(mockDevices as any);

    await checkDeviceOffline();

    // Should mark as offline
    expect(dbDevices.updateDevice).toHaveBeenCalledWith("rpi-001", { isOnline: false });
    // Should send notification
    expect(notifyOwner).toHaveBeenCalledTimes(1);
    expect(notifyOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("设备离线"),
      })
    );
  });

  it("should respect notification cooldown (30 min)", async () => {
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const mockDevices = [
      {
        id: 1,
        deviceId: "rpi-001",
        deviceName: "测试设备",
        isOnline: false,
        lastHeartbeat: threeMinutesAgo,
        lastOfflineNotifiedAt: tenMinutesAgo, // notified 10 min ago, within 30 min cooldown
        location: "301室",
      },
    ];
    vi.mocked(dbDevices.getAllDevices).mockResolvedValue(mockDevices as any);

    await checkDeviceOffline();

    // Should NOT send notification (within cooldown)
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("should skip devices that never connected", async () => {
    const mockDevices = [
      {
        id: 1,
        deviceId: "rpi-002",
        deviceName: "新设备",
        isOnline: false,
        lastHeartbeat: null, // never connected
        lastOfflineNotifiedAt: null,
        location: null,
      },
    ];
    vi.mocked(dbDevices.getAllDevices).mockResolvedValue(mockDevices as any);

    await checkDeviceOffline();

    expect(notifyOwner).not.toHaveBeenCalled();
    expect(dbDevices.updateDevice).not.toHaveBeenCalled();
  });
});
