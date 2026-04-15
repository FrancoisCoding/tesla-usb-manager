import { describe, expect, test } from "vitest";
import {
  shouldShowLightshows,
  shouldShowMusic,
} from "./marketplaceViewFilter";

describe("marketplace view filters", () => {
  test("shows only music in music mode", () => {
    expect(shouldShowMusic("music")).toBe(true);
    expect(shouldShowLightshows("music")).toBe(false);
  });

  test("shows only lightshows in lightshows mode", () => {
    expect(shouldShowMusic("lightshows")).toBe(false);
    expect(shouldShowLightshows("lightshows")).toBe(true);
  });
});
