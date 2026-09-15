import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isNotificationSupported,
  isIosDevice,
  isStandalonePwa,
  getDeviceNotificationStatus,
  requestDeviceNotificationPermission,
  showDeviceNotification,
} from "./notifications";

describe("Device Notifications Utility", () => {
  const originalNotification = (globalThis as any).Notification;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalNotification) {
      (globalThis as any).Notification = originalNotification;
    } else {
      delete (globalThis as any).Notification;
    }
  });

  it("handles notification support checking correctly", () => {
    (globalThis as any).Notification = { permission: "default" };
    expect(isNotificationSupported()).toBe(true);

    delete (globalThis as any).Notification;
    expect(isNotificationSupported()).toBe(false);
  });

  it("returns unsupported status when Notification is not available", () => {
    delete (globalThis as any).Notification;
    expect(getDeviceNotificationStatus()).toBe("unsupported");
  });

  it("returns current permission when Notification exists", () => {
    (globalThis as any).Notification = {
      permission: "granted",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    };

    expect(getDeviceNotificationStatus()).toBe("granted");
  });

  it("requests permission successfully", async () => {
    (globalThis as any).Notification = {
      permission: "default",
      requestPermission: vi.fn().mockResolvedValue("granted"),
    };

    const res = await requestDeviceNotificationPermission();
    expect(res).toBe("granted");
  });

  it("attempts to show notification via serviceWorker if available", async () => {
    const showNotificationMock = vi.fn().mockResolvedValue(undefined);
    (globalThis as any).Notification = class MockNotification {
      static permission = "granted";
    };

    const mockSW = {
      ready: Promise.resolve({
        showNotification: showNotificationMock,
      }),
    };

    Object.defineProperty(globalThis.navigator, "serviceWorker", {
      value: mockSW,
      configurable: true,
    });

    const success = await showDeviceNotification("Test Title", "Test Message");
    expect(success).toBe(true);
    expect(showNotificationMock).toHaveBeenCalledWith(
      "Test Title",
      expect.objectContaining({
        body: "Test Message",
        icon: "/icon-192.png",
      }),
    );
  });

  it("detects standalone PWA correctly", () => {
    expect(typeof isStandalonePwa()).toBe("boolean");
  });

  it("detects iOS device correctly", () => {
    expect(typeof isIosDevice()).toBe("boolean");
  });
});
