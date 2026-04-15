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

  test("accepts .zip light show packages", () => {
    expect(validateTasFilePath("C:\\Shows\\Cyber Groove.zip").ok).toBe(true);
  });

  test("rejects unsupported light show packages", () => {
    const result = validateTasFilePath("C:\\Shows\\Cyber Groove.mp4");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(".tas or .zip");
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
  test("targets Tesla LightShow folder with matching fseq and audio files", () => {
    expect(buildLightShowInstallDestination("E:\\", "Neon_Run_1")).toBe(
      "E:/LightShow/Neon_Run_1.fseq + E:/LightShow/Neon_Run_1.wav",
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
