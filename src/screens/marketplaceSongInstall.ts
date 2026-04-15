import {
  buildInstallDestination,
  type AudioTarget,
} from "../audio/pipeline";
import type { MarketplaceCatalogEntry } from "../audio/tauri";

export interface PendingMarketplaceSongInstall {
  entry: MarketplaceCatalogEntry;
  usbPath: string;
}

export type PrepareMarketplaceSongInstallResult =
  | { ok: true; pendingInstall: PendingMarketplaceSongInstall }
  | { ok: false; error: string };

export function prepareMarketplaceSongInstall(
  entry: MarketplaceCatalogEntry,
  usbPath: string,
): PrepareMarketplaceSongInstallResult {
  const trimmedUsbPath = usbPath.trim();

  if (!trimmedUsbPath) {
    return {
      ok: false,
      error: "Complete Step 1 (USB Setup) first",
    };
  }

  return {
    ok: true,
    pendingInstall: {
      entry,
      usbPath: trimmedUsbPath,
    },
  };
}

export interface MarketplaceSongInstallConfirmation {
  entry: MarketplaceCatalogEntry;
  usbPath: string;
  target: AudioTarget;
  destinationPath: string;
}

export function confirmMarketplaceSongInstall(
  pendingInstall: PendingMarketplaceSongInstall,
  target: AudioTarget,
): MarketplaceSongInstallConfirmation {
  return {
    entry: pendingInstall.entry,
    usbPath: pendingInstall.usbPath,
    target,
    destinationPath: buildInstallDestination(pendingInstall.usbPath, target),
  };
}
