// Device Notification System for Clara PWA
// Supports native device notifications (Android notification shade, iOS 16.4+ lock screen, Windows/macOS)
// using ServiceWorkerRegistration.showNotification with automatic desktop fallback.

export type NotificationStatus = "granted" | "denied" | "default" | "unsupported";

function getNotificationApi(): typeof Notification | undefined {
  if (typeof window !== "undefined" && "Notification" in window) return window.Notification;
  if (typeof globalThis !== "undefined" && "Notification" in (globalThis as any)) return (globalThis as any).Notification;
  return undefined;
}

export function isNotificationSupported(): boolean {
  return getNotificationApi() !== undefined;
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  const isDisplayStandalone =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;
  const isNavigatorStandalone = typeof navigator !== "undefined" && (navigator as any).standalone === true;
  return Boolean(isDisplayStandalone || isNavigatorStandalone);
}

export function getDeviceNotificationStatus(): NotificationStatus {
  const api = getNotificationApi();
  if (!api) {
    return "unsupported";
  }
  return api.permission as NotificationStatus;
}

export async function requestDeviceNotificationPermission(): Promise<NotificationStatus> {
  const api = getNotificationApi();
  if (!api) {
    return "unsupported";
  }
  try {
    const permission = await api.requestPermission();
    return permission as NotificationStatus;
  } catch {
    return new Promise((resolve) => {
      try {
        api.requestPermission((p) => resolve(p as NotificationStatus));
      } catch {
        resolve("denied");
      }
    });
  }
}

export interface ShowDeviceNotificationOptions {
  tag?: string;
  icon?: string;
  badge?: string;
  vibrate?: number[];
  data?: any;
}

export async function showDeviceNotification(
  title: string,
  body: string,
  options?: ShowDeviceNotificationOptions,
): Promise<boolean> {
  const api = getNotificationApi();
  if (!api || api.permission !== "granted") return false;

  const url =
    typeof window !== "undefined"
      ? window.location.origin + (window.location.pathname || "/")
      : "/";

  const notifOptions: NotificationOptions & {
    vibrate?: number[];
    renotify?: boolean;
  } = {
    body,
    icon: options?.icon || "/icon-192.png",
    badge: options?.badge || "/icon-192.png",
    vibrate: options?.vibrate || [150, 60, 150],
    tag: options?.tag || "clara-notification",
    renotify: true,
    data: {
      url,
      ...(options?.data || {}),
    },
  };

  // 1. Primary method: ServiceWorkerRegistration.showNotification
  // Required on Android Chrome and iOS PWA, and standard across all modern browsers
  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg && "showNotification" in reg) {
        await reg.showNotification(title, notifOptions);
        return true;
      }
    } catch (e) {
      console.warn("ServiceWorker showNotification failed:", e);
    }
  }

  // 2. Fallback: classic desktop Notification constructor (Windows / Mac browser tabs)
  try {
    new api(title, notifOptions);
    return true;
  } catch (e) {
    console.warn("new Notification failed:", e);
    return false;
  }
}
