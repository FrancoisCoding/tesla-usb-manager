import { describe, expect, test } from "vitest";
import {
  readSelectedUsbMountPath,
  writeSelectedUsbMountPath,
} from "./selection";

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

function createStorage(initial?: Record<string, string>): StorageLike {
  const values = new Map(Object.entries(initial ?? {}));

  return {
    getItem(key) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

describe("selected USB mount path memory", () => {
  test("returns empty string when no saved path exists", () => {
    const storage = createStorage();

    expect(readSelectedUsbMountPath(storage)).toBe("");
  });

  test("persists and reads back the selected mount path", () => {
    const storage = createStorage();

    writeSelectedUsbMountPath("D:/TeslaUSB", storage);

    expect(readSelectedUsbMountPath(storage)).toBe("D:/TeslaUSB");
  });

  test("clears stored path when provided value is empty after trim", () => {
    const storage = createStorage({ "tesla-usb-manager:selected-usb-path": "D:/" });

    writeSelectedUsbMountPath("   ", storage);

    expect(readSelectedUsbMountPath(storage)).toBe("");
  });
});
