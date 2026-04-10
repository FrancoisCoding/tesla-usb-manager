import { invoke } from "@tauri-apps/api/core";

export type InspectTasFileRequest = {
  sourcePath: string;
};

export type TasInspectionResult = {
  sourcePath: string;
  showName: string;
  entryCount: number;
  entries: string[];
  totalUncompressedBytes: number;
  hasSequenceFile: boolean;
  hasAudioFile: boolean;
  hasPreviewVideo: boolean;
  warnings: string[];
};

export type InstallLightShowRequest = {
  sourcePath: string;
  usbMountPath: string;
  showName?: string;
  overwriteExisting: boolean;
};

export type InstallLightShowResult = {
  sourcePath: string;
  installedPath: string;
  showName: string;
  overwritten: boolean;
  inspection: TasInspectionResult;
};

export function inspectTasFile(
  request: InspectTasFileRequest,
): Promise<TasInspectionResult> {
  return invoke("inspect_tas_file", { request });
}

export function installLightShow(
  request: InstallLightShowRequest,
): Promise<InstallLightShowResult> {
  return invoke("install_lightshow", { request });
}
