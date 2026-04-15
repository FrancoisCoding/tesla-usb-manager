import { describe, expect, test } from "vitest";
import { prepareCustomInstallConfirmation } from "./marketplaceCustomInstall";

describe("prepareCustomInstallConfirmation", () => {
  test("requires a dropped file", () => {
    const result = prepareCustomInstallConfirmation({
      dropFile: null,
      usbPath: "/media/tesla",
      target: "horn",
    });

    expect(result).toEqual({
      ok: false,
      error: "Drop an audio file first",
    });
  });

  test("requires a usb path", () => {
    const result = prepareCustomInstallConfirmation({
      dropFile: { name: "beep.mp3", bytes: [1, 2, 3] },
      usbPath: "   ",
      target: "lock_chime",
    });

    expect(result).toEqual({
      ok: false,
      error: "Complete Step 1 (USB Setup) first",
    });
  });

  test("builds confirmation payload with destination path", () => {
    const result = prepareCustomInstallConfirmation({
      dropFile: { name: "beep.mp3", bytes: [1, 2, 3] },
      usbPath: "D:/TeslaUSB/",
      target: "lock_chime",
    });

    expect(result).toEqual({
      ok: true,
      confirmation: {
        dropFile: { name: "beep.mp3", bytes: [1, 2, 3] },
        usbPath: "D:/TeslaUSB/",
        target: "lock_chime",
        destinationPath: "D:/TeslaUSB/LockChime/LockChime.wav",
      },
    });
  });
});
