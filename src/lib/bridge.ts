import { invoke } from "@tauri-apps/api/core";

export interface SystemHealth {
  platform: string;
  ffmpegSidecar: string;
  ffprobeSidecar: string;
  notes: string[];
}

export async function getSystemHealth(): Promise<SystemHealth> {
  return invoke<SystemHealth>("system_health");
}

export async function probeFfmpegVersion(): Promise<string> {
  return invoke<string>("probe_ffmpeg_sidecar");
}

export interface UsbDriveCandidate {
  id: string;
  mountPath: string;
  displayName: string;
  totalBytes: number | null;
  freeBytes: number | null;
  recommendedFilesystem: string;
}

export interface TeslaFormatPlan {
  mountPath: string;
  volumeLabel: string;
  filesystem: string;
  fingerprint: string;
  foldersToCreate: string[];
  warnings: string[];
}

export interface TeslaFormatPlanRequest {
  mountPath: string;
  totalBytes?: number | null;
  expectedFingerprint?: string;
}

export interface PrepareTeslaUsbLayoutRequest {
  mountPath: string;
  totalBytes?: number | null;
  expectedFingerprint?: string;
}

export interface PrepareTeslaUsbLayoutResult {
  mountPath: string;
  fingerprint: string;
  createdFolders: string[];
}

export async function listUsbDrives(): Promise<UsbDriveCandidate[]> {
  return invoke<UsbDriveCandidate[]>("list_usb_drives");
}

export async function buildTeslaFormatPlan(
  request: TeslaFormatPlanRequest,
): Promise<TeslaFormatPlan> {
  return invoke<TeslaFormatPlan>("build_tesla_format_plan", { request });
}

export async function prepareTeslaUsbLayout(
  request: PrepareTeslaUsbLayoutRequest,
): Promise<PrepareTeslaUsbLayoutResult> {
  return invoke<PrepareTeslaUsbLayoutResult>("prepare_tesla_usb_layout", { request });
}
