export const NATIVE_AUTH_CALLBACK_URL = "app.almidy.premium://auth/callback";

type CapacitorWindow = Window &
  typeof globalThis & {
    Capacitor?: {
      getPlatform?: () => string;
      isNativePlatform?: () => boolean;
    };
  };

export function isNativeCapacitorRuntime() {
  if (typeof window === "undefined") return false;

  const capacitorWindow = window as CapacitorWindow;
  if (!capacitorWindow.Capacitor) return false;

  if (typeof capacitorWindow.Capacitor.isNativePlatform === "function") {
    return capacitorWindow.Capacitor.isNativePlatform();
  }

  return true;
}
