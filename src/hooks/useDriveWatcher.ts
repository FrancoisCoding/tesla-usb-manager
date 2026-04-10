import { useState, useEffect, useCallback } from "react";
import { listUsbDrives, type UsbDriveCandidate } from "../lib/bridge";

export interface DriveWatcherState {
  drives: UsbDriveCandidate[];
  isLoading: boolean;
  error: string | null;
}

/**
 * Polls list_usb_drives every intervalMs milliseconds.
 * Automatically detects inserted/removed drives — no manual refresh needed.
 */
export function useDriveWatcher(intervalMs = 3000): DriveWatcherState {
  const [drives, setDrives] = useState<UsbDriveCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await listUsbDrives();
      setDrives(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [refresh, intervalMs]);

  return { drives, isLoading, error };
}

/** Format bytes to human-readable string, e.g. "256 GB" */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return gb.toFixed(gb >= 10 ? 0 : 1) + " GB";
  const mb = bytes / 1024 ** 2;
  return mb.toFixed(0) + " MB";
}
