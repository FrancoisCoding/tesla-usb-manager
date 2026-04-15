import type { MarketplaceCatalogEntry } from "../audio/tauri";

const ALL_CATEGORY = "All";

export function filterMarketplaceCatalogEntries(
  entries: MarketplaceCatalogEntry[],
  activeCategory: string,
  query: string,
): MarketplaceCatalogEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  return entries.filter((entry) => {
    const matchesCategory =
      activeCategory === ALL_CATEGORY || entry.category === activeCategory;
    if (!matchesCategory) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return (
      entry.name.toLowerCase().includes(normalizedQuery) ||
      entry.category.toLowerCase().includes(normalizedQuery)
    );
  });
}
