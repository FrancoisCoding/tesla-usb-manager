import { describe, expect, test } from "vitest";
import { canSkipToMarketplace, evaluateDriveHealth } from "./usbSetupStatus";

describe("canSkipToMarketplace", () => {
  test("allows skipping when Tesla folders are already present", () => {
    expect(canSkipToMarketplace([])).toBe(true);
  });

  test("requires configuration when folders are missing", () => {
    expect(canSkipToMarketplace(["TeslaCam", "Music"])).toBe(false);
  });
});

describe("evaluateDriveHealth", () => {
  test("returns unknown when size metadata is unavailable", () => {
    expect(evaluateDriveHealth(null, null)).toEqual({
      level: "unknown",
      label: "Unknown",
      detail: "Drive health unavailable",
    });
  });

  test("flags low free space when under ten percent remains", () => {
    expect(evaluateDriveHealth(100, 9)).toEqual({
      level: "warning",
      label: "Low free space",
      detail: "9% free",
    });
  });

  test("marks drive healthy when enough free space remains", () => {
    expect(evaluateDriveHealth(100, 65)).toEqual({
      level: "healthy",
      label: "Healthy",
      detail: "65% free",
    });
  });
});
