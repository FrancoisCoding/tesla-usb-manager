import {
  readSelectedUsbMountPath,
  writeSelectedUsbMountPath,
} from "../usb/selection";

export function initializeMarketplaceUsbPath(
  readPath = readSelectedUsbMountPath,
): string {
  return readPath();
}

export function updateMarketplaceUsbPath(
  nextValue: string,
  writePath = writeSelectedUsbMountPath,
): string {
  // USB mount path is selected in Step 1; we keep this for backwards
  // compatibility in case older code/tests still call it.
  writePath(nextValue);
  return nextValue;
}
