import { describe, expect, test } from "vitest";
import {
  buildCategoryFilters,
  filterMarketplaceItems,
  parseMarketplaceHtml,
} from "./marketplace";

const SAMPLE_HTML = `
<h2>Most Popular</h2>
<div class="audio-player-container" data-category="most-popular">
  <div class="mod mod-audio-player">
    <h2>Shutdown</h2>
    <div class="audio-player-contents">
      <div>
        <h4>Windows</h4>
        <a href="/assets/audio/retro/windows_shutdown.wav" class="fancy download">Download</a>
      </div>
      <img class="audio-player-button" data-button-type="audio" data-audio="/assets/audio/retro/windows_shutdown.mp3" />
    </div>
  </div>
</div>
<h2>Video Games</h2>
<div class="audio-player-container" data-category="video-games">
  <div class="mod mod-audio-player">
    <h2>Emergency Meeting</h2>
    <div class="audio-player-contents">
      <div>
        <h4>Among Us</h4>
        <a href="/assets/audio/video-games/among-us_emergency-meeting.wav" class="fancy download">Download</a>
      </div>
      <img class="audio-player-button" data-button-type="audio" data-audio="/assets/audio/video-games/among-us_emergency-meeting.mp3" />
    </div>
  </div>
</div>
`;

describe("parseMarketplaceHtml", () => {
  test("extracts playable catalog entries with absolute urls", () => {
    const items = parseMarketplaceHtml(SAMPLE_HTML);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: "Shutdown",
      sourceLabel: "Windows",
      categoryId: "most-popular",
      categoryLabel: "Most Popular",
      downloadUrl:
        "https://www.notateslaapp.com/assets/audio/retro/windows_shutdown.wav",
      previewUrl:
        "https://www.notateslaapp.com/assets/audio/retro/windows_shutdown.mp3",
    });
    expect(items[1]).toMatchObject({
      title: "Emergency Meeting",
      categoryId: "video-games",
      categoryLabel: "Video Games",
    });
  });
});

describe("buildCategoryFilters", () => {
  test("returns all filter with ordered category buckets", () => {
    const items = parseMarketplaceHtml(SAMPLE_HTML);
    const filters = buildCategoryFilters(items);

    expect(filters).toEqual([
      { id: "all", label: "All", count: 2 },
      { id: "most-popular", label: "Most Popular", count: 1 },
      { id: "video-games", label: "Video Games", count: 1 },
    ]);
  });
});

describe("filterMarketplaceItems", () => {
  test("filters by category and search text", () => {
    const items = parseMarketplaceHtml(SAMPLE_HTML);
    const categoryFiltered = filterMarketplaceItems(items, "video-games", "");
    expect(categoryFiltered).toHaveLength(1);
    expect(categoryFiltered[0].title).toBe("Emergency Meeting");

    const queryFiltered = filterMarketplaceItems(items, "all", "windows");
    expect(queryFiltered).toHaveLength(1);
    expect(queryFiltered[0].title).toBe("Shutdown");
  });
});
