import { describe, expect, test } from "vitest";
import {
  confirmMarketplaceSongInstall,
  prepareMarketplaceSongInstall,
} from "./marketplaceSongInstall";

const SAMPLE_ENTRY = {
  name: "Retro Beep",
  category: "Retro",
  previewUrl: "https://example.com/retro.mp3",
  downloadUrl: "https://example.com/retro.wav",
};

describe("prepareMarketplaceSongInstall", () => {
  test("requires a usb path", () => {
    const result = prepareMarketplaceSongInstall(SAMPLE_ENTRY, "   ");

    expect(result).toEqual({
      ok: false,
      error: "Complete Step 1 (USB Setup) first",
    });
  });

  test("returns pending install payload with trimmed usb path", () => {
    const result = prepareMarketplaceSongInstall(SAMPLE_ENTRY, " D:/TeslaUSB/ ");

    expect(result).toEqual({
      ok: true,
      pendingInstall: {
        entry: SAMPLE_ENTRY,
        usbPath: "D:/TeslaUSB/",
      },
    });
  });
});

describe("confirmMarketplaceSongInstall", () => {
  test("builds destination path for selected target", () => {
    const confirmation = confirmMarketplaceSongInstall(
      {
        entry: SAMPLE_ENTRY,
        usbPath: "D:/TeslaUSB/",
      },
      "lock_chime",
    );

    expect(confirmation).toEqual({
      entry: SAMPLE_ENTRY,
      usbPath: "D:/TeslaUSB/",
      target: "lock_chime",
      destinationPath: "D:/TeslaUSB/LockChime/LockChime.wav",
    });
  });
});
