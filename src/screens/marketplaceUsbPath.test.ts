import { describe, expect, test, vi } from "vitest";
import {
  initializeMarketplaceUsbPath,
  updateMarketplaceUsbPath,
} from "./marketplaceUsbPath";

describe("initializeMarketplaceUsbPath", () => {
  test("hydrates usb path from saved drive selection", () => {
    const readSelectedUsbMountPath = vi.fn(() => "E:/TeslaDrive");

    expect(initializeMarketplaceUsbPath(readSelectedUsbMountPath)).toBe("E:/TeslaDrive");
  });
});

describe("updateMarketplaceUsbPath", () => {
  test("persists user-entered usb path and keeps typed value in state", () => {
    const writeSelectedUsbMountPath = vi.fn();

    expect(updateMarketplaceUsbPath("D:/", writeSelectedUsbMountPath)).toBe("D:/");
    expect(writeSelectedUsbMountPath).toHaveBeenCalledWith("D:/");
  });
});
