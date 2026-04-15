type ValidationSuccess = { ok: true };
type ValidationFailure = { ok: false; error: string };
export type ValidationResult = ValidationSuccess | ValidationFailure;

export type ImportedShowSummary = {
  sourcePath: string;
  showName: string;
  warningCount: number;
};

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function trimTrailingSeparators(value: string): string {
  return toPosixPath(value).replace(/\/+$/g, "");
}

function fileExtension(pathValue: string): string | null {
  const trimmed = pathValue.trim();
  const dotIndex = trimmed.lastIndexOf(".");

  if (dotIndex < 0 || dotIndex === trimmed.length - 1) {
    return null;
  }

  return trimmed.slice(dotIndex + 1).toLowerCase();
}

export function validateTasFilePath(pathValue: string): ValidationResult {
  const extension = fileExtension(pathValue);

  if (extension !== "tas" && extension !== "zip") {
    return { ok: false, error: "Only .tas or .zip light show packages are supported." };
  }

  return { ok: true };
}

export function deriveShowNameFromPath(pathValue: string): string {
  const normalizedPath = toPosixPath(pathValue.trim());
  const rawFileName = normalizedPath.split("/").pop() ?? "";
  const rawStem = rawFileName.replace(/\.[^.]+$/g, "");
  const sanitized = rawStem
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);

  return sanitized || "LightShow";
}

export function buildLightShowInstallDestination(
  usbRoot: string,
  showName: string,
): string {
  const base = trimTrailingSeparators(usbRoot);
  return `${base}/LightShow/${showName}.fseq + ${base}/LightShow/${showName}.wav`;
}

export function mergeImportedShows(
  current: ImportedShowSummary[],
  next: ImportedShowSummary,
): ImportedShowSummary[] {
  const filtered = current.filter((show) => show.sourcePath !== next.sourcePath);
  return [next, ...filtered];
}
