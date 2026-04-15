export type MarketplaceViewFilter = "music" | "lightshows";

export function shouldShowMusic(filter: MarketplaceViewFilter): boolean {
  return filter === "music";
}

export function shouldShowLightshows(filter: MarketplaceViewFilter): boolean {
  return filter === "lightshows";
}
