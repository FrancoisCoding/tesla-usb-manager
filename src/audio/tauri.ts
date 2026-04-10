import { invoke } from "@tauri-apps/api/core";
import type { AudioTarget } from "./pipeline";

export type ProcessAudioPipelineRequest = {
  sourcePath: string;
  usbMountPath: string;
  target: AudioTarget;
  normalize: boolean;
  ffmpegPath?: string;
};

export type ProcessAudioPipelineResult = {
  sourcePath: string;
  convertedPath: string;
  installedPath: string;
  ffmpegArgs: string[];
};

export type MarketplaceCatalogEntry = {
  name: string;
  category: string;
  previewUrl: string;
  downloadUrl: string;
};

export type MarketplaceCatalogResult = {
  sourceUrl: string;
  fetchedAtEpochMs: number;
  cached: boolean;
  entries: MarketplaceCatalogEntry[];
};

export type MarketplaceCatalogRequest = {
  refresh?: boolean;
};

export type DownloadMarketplaceAudioRequest = {
  downloadUrl: string;
};

export type DownloadMarketplaceAudioResult = {
  downloadUrl: string;
  tempPath: string;
  bytes: number;
};

export type PersistUploadedAudioRequest = {
  fileName: string;
  bytes: number[];
};

export type PersistUploadedAudioResult = {
  sourcePath: string;
  fileName: string;
  sizeBytes: number;
};

export function processAudioPipeline(
  request: ProcessAudioPipelineRequest,
): Promise<ProcessAudioPipelineResult> {
  return invoke("process_audio_pipeline", { request });
}

export function fetchMarketplaceCatalog(
  request: MarketplaceCatalogRequest = {},
): Promise<MarketplaceCatalogResult> {
  return invoke("fetch_marketplace_catalog", {
    request,
  });
}

export function downloadMarketplaceAudio(
  request: DownloadMarketplaceAudioRequest,
): Promise<DownloadMarketplaceAudioResult> {
  return invoke("download_marketplace_audio", { request });
}

export function persistUploadedAudio(
  request: PersistUploadedAudioRequest,
): Promise<PersistUploadedAudioResult> {
  return invoke("persist_uploaded_audio", { request });
}
