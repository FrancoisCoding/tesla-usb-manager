import {
  buildInstallDestination,
  type AudioTarget,
} from "../audio/pipeline";

export interface CustomInstallDropFile {
  name: string;
  bytes: number[];
}

export interface CustomInstallConfirmation {
  dropFile: CustomInstallDropFile;
  usbPath: string;
  target: AudioTarget;
  destinationPath: string;
}

export type PrepareCustomInstallResult =
  | { ok: true; confirmation: CustomInstallConfirmation }
  | { ok: false; error: string };

export interface PrepareCustomInstallInput {
  dropFile: CustomInstallDropFile | null;
  usbPath: string;
  target: AudioTarget;
}

export function prepareCustomInstallConfirmation(
  input: PrepareCustomInstallInput,
): PrepareCustomInstallResult {
  if (!input.dropFile) {
    return {
      ok: false,
      error: "Drop an audio file first",
    };
  }

  const usbPath = input.usbPath.trim();
  if (!usbPath) {
    return {
      ok: false,
      error: "Complete Step 1 (USB Setup) first",
    };
  }

  return {
    ok: true,
    confirmation: {
      dropFile: input.dropFile,
      usbPath,
      target: input.target,
      destinationPath: buildInstallDestination(usbPath, input.target),
    },
  };
}
