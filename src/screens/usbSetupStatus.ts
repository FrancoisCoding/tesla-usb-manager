export type DriveHealthLevel = "healthy" | "warning" | "unknown";

export interface DriveHealthSummary {
  level: DriveHealthLevel;
  label: string;
  detail: string;
}

export function canSkipToMarketplace(missingFolders: string[]): boolean {
  return missingFolders.length === 0;
}

export function evaluateDriveHealth(
  totalBytes: number | null,
  freeBytes: number | null,
): DriveHealthSummary {
  if (!totalBytes || freeBytes == null || totalBytes <= 0) {
    return {
      level: "unknown",
      label: "Unknown",
      detail: "Drive health unavailable",
    };
  }

  const freePercent = Math.max(0, Math.min(100, Math.round((freeBytes / totalBytes) * 100)));

  if (freePercent < 10) {
    return {
      level: "warning",
      label: "Low free space",
      detail: `${freePercent}% free`,
    };
  }

  return {
    level: "healthy",
    label: "Healthy",
    detail: `${freePercent}% free`,
  };
}
