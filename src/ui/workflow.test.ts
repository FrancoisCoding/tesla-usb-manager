import { describe, expect, test } from "vitest";
import {
  buildApplyStagePlan,
  computeApplyProgressPercent,
  hasDestructiveApplyStage,
  validateDestructiveConfirmation,
} from "./workflow";

describe("buildApplyStagePlan", () => {
  test("orders selected apply stages by execution flow", () => {
    const plan = buildApplyStagePlan({
      prepareLayout: true,
      installAudio: true,
      installLightShow: true,
    });

    expect(plan.map((stage) => stage.id)).toEqual([
      "prepare_layout",
      "audio_install",
      "lightshow_install",
    ]);
  });

  test("omits unselected stages", () => {
    const plan = buildApplyStagePlan({
      prepareLayout: false,
      installAudio: true,
      installLightShow: false,
    });

    expect(plan).toEqual([
      {
        id: "audio_install",
        label: "Install horn/chime audio",
        destructive: false,
      },
    ]);
  });
});

describe("hasDestructiveApplyStage", () => {
  test("returns true when drive layout prep is included", () => {
    const plan = buildApplyStagePlan({
      prepareLayout: true,
      installAudio: false,
      installLightShow: false,
    });

    expect(hasDestructiveApplyStage(plan)).toBe(true);
  });
});

describe("validateDestructiveConfirmation", () => {
  test("rejects when typed confirmation does not match expected string", () => {
    const result = validateDestructiveConfirmation({
      typedValue: "PREPARE TESLA-USB",
      expectedValue: "PREPARE DRIVE-01",
    });

    expect(result).toEqual({
      ok: false,
      error: 'Type "PREPARE DRIVE-01" to confirm layout preparation.',
    });
  });

  test("accepts exact typed confirmation", () => {
    const result = validateDestructiveConfirmation({
      typedValue: "PREPARE DRIVE-01",
      expectedValue: "PREPARE DRIVE-01",
    });

    expect(result).toEqual({ ok: true });
  });
});

describe("computeApplyProgressPercent", () => {
  test("returns 0 for empty plans", () => {
    expect(computeApplyProgressPercent(0, 0)).toBe(0);
  });

  test("returns rounded completion percentage", () => {
    expect(computeApplyProgressPercent(3, 1)).toBe(33);
    expect(computeApplyProgressPercent(3, 2)).toBe(67);
    expect(computeApplyProgressPercent(4, 4)).toBe(100);
  });
});
