import { invoke } from "@tauri-apps/api/core";

export type LightShowEntry = {
  id: number;
  title: string;
  author: string;
  uploadDate: string;
  duration: string;
  downloadCount: number;
  upvotes: number;
  downvotes: number;
  youtubeEmbedUrl: string;
};

export type FetchLightShowsRequest = {
  page?: number;
  category?: string;
  sortType?: string;
  sortOrder?: string;
  search?: string;
};

export type FetchLightShowsResponse = {
  page: number;
  entries: LightShowEntry[];
  fetchedAtEpochMs: number;
};

export type DownloadInstallLightShowRequest = {
  showId: number;
  usbMountPath: string;
  showName?: string;
  overwriteExisting: boolean;
};

export type DownloadInstallLightShowResult = {
  showId: number;
  installedPath: string;
  showName: string;
  bytes: number;
};

export function fetchLightShows(request: FetchLightShowsRequest): Promise<FetchLightShowsResponse> {
  return invoke("fetch_lightshows", { request });
}

export function downloadInstallLightShow(request: DownloadInstallLightShowRequest): Promise<DownloadInstallLightShowResult> {
  return invoke("download_install_lightshow", { request });
}

export function youtubeVideoId(embedUrl: string): string {
  const idx = embedUrl.indexOf("/embed/");
  if (idx < 0) return String();
  return embedUrl.slice(idx + 7).split("?")[0].split("#")[0];
}

export function youtubeThumbnail(videoId: string): string {
  if (!videoId) return String();
  return "https://img.youtube.com/vi/" + videoId + "/mqdefault.jpg";
}

