import { describe, expect, test } from "vitest";
import {
  buildFfmpegArgs,
  buildInstallDestination,
  validateInputFileName,
} from "./pipeline";

describe("validateInputFileName", () => {
  test("accepts mp3, wav, ogg, and flac file names", () => {
    expect(validateInputFileName("ding.mp3").ok).toBe(true);
    expect(validateInputFileName("ding.wav").ok).toBe(true);
    expect(validateInputFileName("ding.ogg").ok).toBe(true);
    expect(validateInputFileName("ding.flac").ok).toBe(true);
  });

  test("rejects unsupported formats", () => {
    const result = validateInputFileName("ding.aac");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Supported formats");
    }
  });
});

describe("buildFfmpegArgs", () => {
  test("adds normalization filter when requested", () => {
    const args = buildFfmpegArgs({
      inputPath: "/tmp/in.flac",
      outputPath: "/tmp/out.wav",
      normalize: true,
    });

    expect(args).toContain("-af");
    expect(args).toContain("loudnorm=I=-16:TP=-1.5:LRA=11");
    expect(args).toContain("/tmp/out.wav");
  });
});

describe("buildInstallDestination", () => {
  test("maps targets to Tesla USB destinations", () => {
    expect(buildInstallDestination("/usb", "lock_chime")).toBe(
      "/usb/LockChime.wav",
    );
    expect(buildInstallDestination("/usb", "horn")).toBe(
      "/usb/Boombox/Horn.wav",
    );
  });
});
