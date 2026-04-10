import { describe, expect, test } from "vitest";
import {
  buildLightShowInstallDestination,
  deriveShowNameFromPath,
  mergeImportedShows,
  validateTasFilePath,
  type ImportedShowSummary,
} from "./pipeline";

describe("validateTasFilePath", () => {
  test("accepts .tas files", () => {
    expect(validateTasFilePath("C:\\Shows\\Cyber Groove.tas").ok).toBe(true);
  });

  test("rejects non-.tas files", () => {
    const result = validateTasFilePath("C:\\Shows\\Cyber Groove.zip");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(".tas");
    }
  });
});

describe("deriveShowNameFromPath", () => {
  test("uses file stem and normalizes unsafe characters", () => {
    expect(deriveShowNameFromPath("C:\\Shows\\Neon:Run #1!!.tas")).toBe(
      "Neon_Run_1",
    );
  });

  test("falls back when there is no usable stem", () => {
    expect(deriveShowNameFromPath("C:\\Shows\\.tas")).toBe("LightShow");
  });
});

describe("buildLightShowInstallDestination", () => {
  test("targets Tesla LIGHTSHOW folder", () => {
    expect(buildLightShowInstallDestination("E:\\", "Neon_Run_1")).toBe(
      "E:/LIGHTSHOW/Neon_Run_1.tas",
    );
  });
});

describe("mergeImportedShows", () => {
  test("upserts by source path and keeps most recent at top", () => {
    const first: ImportedShowSummary = {
      sourcePath: "C:\\Shows\\one.tas",
      showName: "One",
      warningCount: 0,
    };
    const second: ImportedShowSummary = {
      sourcePath: "C:\\Shows\\two.tas",
      showName: "Two",
      warningCount: 1,
    };
    const firstUpdated: ImportedShowSummary = {
      sourcePath: "C:\\Shows\\one.tas",
      showName: "One Updated",
      warningCount: 2,
    };

    const once = mergeImportedShows([], first);
    const twice = mergeImportedShows(once, second);
    const thrice = mergeImportedShows(twice, firstUpdated);

    expect(thrice).toEqual([firstUpdated, second]);
  });
});
