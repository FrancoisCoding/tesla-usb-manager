export type AudioTarget = "lock_chime" | "horn";

type ValidationSuccess = { ok: true };
type ValidationFailure = { ok: false; error: string };
export type ValidationResult = ValidationSuccess | ValidationFailure;

export type BuildFfmpegArgsInput = {
  inputPath: string;
  outputPath: string;
  normalize: boolean;
};

const SUPPORTED_EXTENSIONS = new Set(["mp3", "wav", "ogg", "flac"]);
const NORMALIZE_FILTER = "loudnorm=I=-16:TP=-1.5:LRA=11";

function toPosixPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function fileExtension(fileName: string): string | null {
  const trimmed = fileName.trim();
  const dotIndex = trimmed.lastIndexOf(".");

  if (dotIndex < 0 || dotIndex === trimmed.length - 1) {
    return null;
  }

  return trimmed.slice(dotIndex + 1).toLowerCase();
}

function trimTrailingSeparators(value: string): string {
  return toPosixPath(value).replace(/\/+$/g, "");
}

export function validateInputFileName(fileName: string): ValidationResult {
  const extension = fileExtension(fileName);

  if (!extension || !SUPPORTED_EXTENSIONS.has(extension)) {
    return {
      ok: false,
      error: "Supported formats: MP3, WAV, OGG, FLAC.",
    };
  }

  return { ok: true };
}

export function buildFfmpegArgs(input: BuildFfmpegArgsInput): string[] {
  const args = ["-y", "-i", input.inputPath];

  if (input.normalize) {
    args.push("-af", NORMALIZE_FILTER);
  }

  args.push(
    "-ac",
    "2",
    "-ar",
    "44100",
    "-c:a",
    "pcm_s16le",
    input.outputPath,
  );

  return args;
}

export function buildInstallDestination(
  usbRoot: string,
  target: AudioTarget,
): string {
  const base = trimTrailingSeparators(usbRoot);
  const suffix =
    target === "lock_chime" ? "LockChime/LockChime.wav" : "Boombox/Horn.wav";

  return `${base}/${suffix}`;
}
