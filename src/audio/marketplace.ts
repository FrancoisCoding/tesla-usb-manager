export const DEFAULT_MARKETPLACE_SOURCE_URL =
  "https://www.notateslaapp.com/tesla-custom-lock-sounds/";

export interface MarketplaceAudioItem {
  id: string;
  title: string;
  sourceLabel: string;
  categoryId: string;
  categoryLabel: string;
  downloadUrl: string;
  previewUrl: string;
  fileName: string;
}

export interface MarketplaceCategoryFilter {
  id: string;
  label: string;
  count: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  "most-popular": "Most Popular",
  cartoons: "Cartoons",
  retro: "Retro / 90s",
  "shows-movies": "Movies & TV",
  "video-games": "Video Games",
  holidays: "Holidays",
  others: "Miscellaneous",
};

const CATEGORY_ORDER = [
  "most-popular",
  "cartoons",
  "retro",
  "shows-movies",
  "video-games",
  "holidays",
  "others",
] as const;

function decodeHtml(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", "\"")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function readMatch(input: string, pattern: RegExp): string | null {
  const match = input.match(pattern);
  if (!match?.[1]) {
    return null;
  }
  return decodeHtml(stripHtml(match[1]).trim());
}

function ensureAbsoluteUrl(url: string, baseUrl: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const base = new URL(normalizedBase);
  return new URL(url, base.origin).toString();
}

function inferFileName(url: string): string {
  const normalized = url.split("?")[0];
  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? "marketplace-audio.wav";
}

export function categoryLabelForId(categoryId: string): string {
  return CATEGORY_LABELS[categoryId] ?? categoryId.replaceAll("-", " ");
}

export function parseMarketplaceHtml(
  html: string,
  sourceUrl = DEFAULT_MARKETPLACE_SOURCE_URL,
): MarketplaceAudioItem[] {
  const items: MarketplaceAudioItem[] = [];
  const containerMarker = '<div class="audio-player-container" data-category="';
  let cursor = 0;
  let globalIndex = 0;

  while (true) {
    const start = html.indexOf(containerMarker, cursor);
    if (start === -1) {
      break;
    }

    const categoryStart = start + containerMarker.length;
    const categoryEnd = html.indexOf("\"", categoryStart);
    if (categoryEnd === -1) {
      break;
    }

    const categoryId = html.slice(categoryStart, categoryEnd).trim();
    const nextContainer = html.indexOf(containerMarker, categoryEnd);
    const section = html.slice(categoryEnd, nextContainer === -1 ? html.length : nextContainer);
    const cardChunks = section.split('<div class="mod mod-audio-player">').slice(1);

    for (const chunk of cardChunks) {
      const title = readMatch(chunk, /<h2>([\s\S]*?)<\/h2>/i);
      const sourceLabel = readMatch(chunk, /<h4>([\s\S]*?)<\/h4>/i);
      const downloadPath = readMatch(chunk, /<a href="([^"]+)"[^>]*class="[^"]*download[^"]*"/i);
      const previewPath = readMatch(chunk, /data-audio="([^"]+)"/i);

      if (!title || !sourceLabel || !downloadPath || !previewPath) {
        continue;
      }

      const downloadUrl = ensureAbsoluteUrl(downloadPath, sourceUrl);
      const previewUrl = ensureAbsoluteUrl(previewPath, sourceUrl);
      const fileName = inferFileName(downloadUrl);
      globalIndex += 1;
      items.push({
        id: `${categoryId}-${globalIndex}`,
        title,
        sourceLabel,
        categoryId,
        categoryLabel: categoryLabelForId(categoryId),
        downloadUrl,
        previewUrl,
        fileName,
      });
    }

    cursor = nextContainer === -1 ? html.length : nextContainer;
  }

  return items;
}

export function buildCategoryFilters(
  items: MarketplaceAudioItem[],
): MarketplaceCategoryFilter[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
  }

  const known = CATEGORY_ORDER.filter((categoryId) => counts.has(categoryId)).map((categoryId) => ({
    id: categoryId,
    label: categoryLabelForId(categoryId),
    count: counts.get(categoryId) ?? 0,
  }));

  const unknown = [...counts.entries()]
    .filter(([categoryId]) => !CATEGORY_ORDER.includes(categoryId as (typeof CATEGORY_ORDER)[number]))
    .map(([categoryId, count]) => ({
      id: categoryId,
      label: categoryLabelForId(categoryId),
      count,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return [
    { id: "all", label: "All", count: items.length },
    ...known,
    ...unknown,
  ];
}

export function filterMarketplaceItems(
  items: MarketplaceAudioItem[],
  categoryId: string,
  query: string,
): MarketplaceAudioItem[] {
  const queryLower = query.trim().toLowerCase();

  return items.filter((item) => {
    if (categoryId !== "all" && item.categoryId !== categoryId) {
      return false;
    }

    if (!queryLower) {
      return true;
    }

    return (
      item.title.toLowerCase().includes(queryLower) ||
      item.sourceLabel.toLowerCase().includes(queryLower) ||
      item.categoryLabel.toLowerCase().includes(queryLower)
    );
  });
}
