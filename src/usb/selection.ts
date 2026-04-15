type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export const SELECTED_USB_PATH_KEY = "tesla-usb-manager:selected-usb-path";

function defaultStorage(): StorageLike | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function readSelectedUsbMountPath(storage = defaultStorage()): string {
  if (!storage) return "";

  try {
    return storage.getItem(SELECTED_USB_PATH_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeSelectedUsbMountPath(
  mountPath: string,
  storage = defaultStorage(),
): void {
  if (!storage) return;

  const normalized = mountPath.trim();

  try {
    if (!normalized) {
      storage.removeItem(SELECTED_USB_PATH_KEY);
      return;
    }

    storage.setItem(SELECTED_USB_PATH_KEY, normalized);
  } catch {
    // Ignore storage failures in restricted browser environments.
  }
}
