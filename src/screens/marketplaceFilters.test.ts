import { describe, expect, test } from "vitest";
import type { MarketplaceCatalogEntry } from "../audio/tauri";
import { filterMarketplaceCatalogEntries } from "./marketplaceFilters";

const SAMPLE_ENTRIES: MarketplaceCatalogEntry[] = [
  {
    name: "Windows Shutdown",
    category: "Retro",
    previewUrl: "https://example.com/windows.mp3",
    downloadUrl: "https://example.com/windows.wav",
  },
  {
    name: "Emergency Meeting",
    category: "Video Games",
    previewUrl: "https://example.com/among-us.mp3",
    downloadUrl: "https://example.com/among-us.wav",
  },
];

describe("filterMarketplaceCatalogEntries", () => {
  test("filters by category and search query", () => {
    expect(
      filterMarketplaceCatalogEntries(SAMPLE_ENTRIES, "Video Games", ""),
    ).toEqual([SAMPLE_ENTRIES[1]]);

    expect(
      filterMarketplaceCatalogEntries(SAMPLE_ENTRIES, "All", "windows"),
    ).toEqual([SAMPLE_ENTRIES[0]]);
  });

  test("matches search against category labels", () => {
    expect(
      filterMarketplaceCatalogEntries(SAMPLE_ENTRIES, "All", "video"),
    ).toEqual([SAMPLE_ENTRIES[1]]);
  });
});
