import { useState, useEffect, useRef } from "react";
import {
  fetchMarketplaceCatalog,
  downloadMarketplaceAudio,
  processAudioPipeline,
  persistUploadedAudio,
} from "../audio/tauri";
import type { MarketplaceCatalogEntry } from "../audio/tauri";
import type { AudioTarget } from "../audio/pipeline";
import {
  prepareCustomInstallConfirmation,
  type CustomInstallConfirmation,
  type CustomInstallDropFile,
} from "./marketplaceCustomInstall";
import { filterMarketplaceCatalogEntries } from "./marketplaceFilters";
import Lighthouse from "./Lighthouse";
import {
  confirmMarketplaceSongInstall,
  prepareMarketplaceSongInstall,
  type PendingMarketplaceSongInstall,
} from "./marketplaceSongInstall";
import {
  type MarketplaceViewFilter,
  shouldShowLightshows,
  shouldShowMusic,
} from "./marketplaceViewFilter";
import { readSelectedUsbMountPath } from "../usb/selection";

function SoundArt({ url, name }: { url?: string; name: string }) {
  const [err, setErr] = useState(false);
  return (
    <div className="sound-art">
      {url && !err ? (
        <img
          src={url}
          alt={name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setErr(true)}
        />
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" />
        </svg>
      )}
    </div>
  );
}

const ALL_CAT = "All";

function audioTargetLabel(target: AudioTarget): string {
  return target === "lock_chime" ? "Lock Chime" : "Horn";
}

export default function Marketplace() {
  const [viewFilter, setViewFilter] = useState("music" as MarketplaceViewFilter);
  const [entries, setEntries] = useState([] as MarketplaceCatalogEntry[]);
  const [loading, setLoading] = useState(false);
  const [catalogErr, setCatalogErr] = useState(null as string | null);
  const [activeTab, setActiveTab] = useState(ALL_CAT);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const [usbPath] = useState(() => readSelectedUsbMountPath());
  const audioRef = useRef(null as HTMLAudioElement | null);
  const [playingUrl, setPlayingUrl] = useState(null as string | null);
  const [installing, setInstalling] = useState({} as Record<string, boolean>);
  const [installMsg, setInstallMsg] = useState({} as Record<string, string>);
  const [pendingSongInstall, setPendingSongInstall] = useState(
    null as PendingMarketplaceSongInstall | null,
  );
  const [dragOver, setDragOver] = useState(false);
  const [dropFile, setDropFile] = useState(null as CustomInstallDropFile | null);
  const [dropTarget, setDropTarget] = useState("horn" as AudioTarget);
  const [uploadMsg, setUploadMsg] = useState(null as string | null);
  const [uploading, setUploading] = useState(false);
  const [pendingUploadConfirmation, setPendingUploadConfirmation] = useState(
    null as CustomInstallConfirmation | null,
  );

  useEffect(() => {
    loadCatalog(false);
  }, []);

  async function loadCatalog(refresh: boolean) {
    setLoading(true);
    setCatalogErr(null);
    try {
      const result = await fetchMarketplaceCatalog({ refresh });
      setEntries(result.entries);
    } catch (e) {
      setCatalogErr(String(e));
    } finally {
      setLoading(false);
    }
  }

  const categories = [
    ALL_CAT,
    ...Array.from(new Set(entries.map((e) => e.category).filter(Boolean))),
  ];

  const filtered = filterMarketplaceCatalogEntries(entries, activeTab, searchQuery);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const showMusic = shouldShowMusic(viewFilter);
  const showLightshows = shouldShowLightshows(viewFilter);

  useEffect(() => {
    if (showMusic) return;
    setPendingSongInstall(null);
    setPendingUploadConfirmation(null);
  }, [showMusic]);

  function togglePreview(url: string) {
    if (playingUrl === url) {
      audioRef.current?.pause();
      setPlayingUrl(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setPlayingUrl(url);
    audio.onended = () => setPlayingUrl(null);
  }

  async function handleInstall(entry: MarketplaceCatalogEntry) {
    const installRequest = prepareMarketplaceSongInstall(entry, usbPath);
    if (!installRequest.ok) {
      setInstallMsg((m) => ({
        ...m,
        [entry.downloadUrl]: installRequest.error,
      }));
      return;
    }
    setPendingSongInstall(installRequest.pendingInstall);
  }

  async function handleConfirmSongInstall(target: AudioTarget) {
    if (!pendingSongInstall) return;
    const confirmation = confirmMarketplaceSongInstall(pendingSongInstall, target);
    const key = confirmation.entry.downloadUrl;
    setPendingSongInstall(null);
    setInstalling((s) => ({ ...s, [key]: true }));
    setInstallMsg((m) => ({ ...m, [key]: String() }));
    try {
      const dl = await downloadMarketplaceAudio({
        downloadUrl: confirmation.entry.downloadUrl,
      });
      await processAudioPipeline({
        sourcePath: dl.tempPath,
        usbMountPath: confirmation.usbPath,
        target: confirmation.target,
        normalize: true,
      });
      setInstallMsg((m) => ({
        ...m,
        [key]: `Installed to ${audioTargetLabel(confirmation.target)}!`,
      }));
    } catch (e) {
      setInstallMsg((m) => ({
        ...m,
        [key]: "Error: " + String(e),
      }));
    } finally {
      setInstalling((s) => ({ ...s, [key]: false }));
    }
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const bytes = Array.from(new Uint8Array(buf));
    setDropFile({ name: file.name, bytes });
    setUploadMsg(null);
  }

  async function handleUpload() {
    const result = prepareCustomInstallConfirmation({
      dropFile,
      usbPath,
      target: dropTarget,
    });

    if (!result.ok) {
      setUploadMsg(result.error);
      return;
    }

    setPendingUploadConfirmation(result.confirmation);
    setUploadMsg(null);
  }

  async function handleConfirmUpload() {
    if (!pendingUploadConfirmation) return;

    setUploading(true);
    setUploadMsg(null);
    try {
      const persisted = await persistUploadedAudio({
        fileName: pendingUploadConfirmation.dropFile.name,
        bytes: pendingUploadConfirmation.dropFile.bytes,
      });
      await processAudioPipeline({
        sourcePath: persisted.sourcePath,
        usbMountPath: pendingUploadConfirmation.usbPath,
        target: pendingUploadConfirmation.target,
        normalize: true,
      });
      setUploadMsg("Installed to " + pendingUploadConfirmation.destinationPath);
      setDropFile(null);
      setPendingUploadConfirmation(null);
    } catch (e) {
      setUploadMsg("Error: " + String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="content">
      <div className="filter-tabs" role="tablist" aria-label="Marketplace view">
        <button
          role="tab"
          aria-selected={viewFilter === "music"}
          className={viewFilter === "music" ? "filter-tab active" : "filter-tab"}
          onClick={() => setViewFilter("music")}
        >
          Music
        </button>
        <button
          role="tab"
          aria-selected={viewFilter === "lightshows"}
          className={viewFilter === "lightshows" ? "filter-tab active" : "filter-tab"}
          onClick={() => setViewFilter("lightshows")}
        >
          Light Shows
        </button>
      </div>

      {showMusic && (
        <div>
          <div className="card" style={{ marginBottom: "1rem" }}>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.25rem" }}>
              Step 2 of 2: Marketplace
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Browse and install audio, music, and light shows. Use filters to narrow by type.
            </div>
          </div>

          <div className="flex items-center gap-1" style={{ marginBottom: "1rem" }}>
            <label className="label-sm" style={{ whiteSpace: "nowrap" }}>
              USB Mount Path
            </label>
            <div className="mount-path-badge" style={{ flex: 1, opacity: usbPath.trim() ? 1 : 0.75 }}>
              <span className="mount-path-badge-dot" aria-hidden="true" />
              <span className="mount-path-badge-label">
                {usbPath.trim() ? usbPath : "No drive selected. Complete Step 1 first."}
              </span>
            </div>
          </div>

          <div className="filter-tabs" role="tablist" aria-label="Music category filter">
            {categories.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={activeTab === tab ? "filter-tab active" : "filter-tab"}
                onClick={() => {
                  setActiveTab(tab);
                  setPage(1);
                }}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1" style={{ marginBottom: "1rem" }}>
            <label htmlFor="marketplace-search" className="label-sm" style={{ whiteSpace: "nowrap" }}>
              Search
            </label>
            <input
              id="marketplace-search"
              className="input-sm"
              style={{ flex: 1 }}
              placeholder="Filter sounds by name or category"
              value={searchQuery}
              onChange={(ev) => {
                setSearchQuery(ev.target.value);
                setPage(1);
              }}
            />
          </div>

          {catalogErr && (
            <div className="card" style={{ color: "var(--accent)", marginBottom: "1rem" }}>
              Failed to load catalog: {catalogErr}
            </div>
          )}

          {loading && !entries.length ? (
            <div className="text-muted" style={{ padding: "2rem 0" }}>
              Loading catalog...
            </div>
          ) : (
            <>
              <div className="sound-grid">
                {paginated.length === 0 && (
                  <div className="text-muted">No sounds match your search.</div>
                )}
                {paginated.map((sound) => {
                  const key = sound.downloadUrl;
                  const isPlaying = playingUrl === sound.previewUrl;
                  return (
                    <div key={key} className="sound-card">
                      <SoundArt url={sound.imageUrl} name={sound.name} />
                      <div className="sound-info">
                        <div className="sound-name">{sound.name}</div>
                        {sound.category && (
                          <div
                            style={{
                              fontSize: "0.68rem",
                              color: "var(--text-muted)",
                              marginTop: "2px",
                            }}
                          >
                            {sound.category}
                          </div>
                        )}
                      </div>
                      <div className="sound-actions">
                        {sound.previewUrl && (
                          <button
                            className="btn btn-ghost btn-sm sound-action-btn"
                            title={isPlaying ? "Stop preview" : "Play preview"}
                            aria-label={isPlaying ? "Stop preview" : "Play preview"}
                            onClick={() => togglePreview(sound.previewUrl)}
                          >
                            {isPlaying ? "Stop" : "Play"}
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm sound-action-btn"
                          disabled={installing[key]}
                          onClick={() => handleInstall(sound)}
                        >
                          {installing[key] ? "..." : "Install"}
                        </button>
                      </div>
                      {installMsg[key] && (
                        <div
                          role="status"
                          aria-live="polite"
                          style={{
                            fontSize: "0.68rem",
                            padding: "0 0.75rem 0.5rem",
                            color: installMsg[key].startsWith("Error")
                              ? "var(--accent)"
                              : "var(--green)",
                          }}
                        >
                          {installMsg[key]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {filtered.length > PAGE_SIZE && (
                <div
                  className="flex items-center gap-1"
                  style={{ marginTop: "0.75rem", justifyContent: "center" }}
                >
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Prev
                  </button>
                  <span className="text-sm text-muted">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}

          <div className="card" style={{ marginTop: "1rem" }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.85rem",
                marginBottom: "0.5rem",
              }}
            >
              Import Custom Audio
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginBottom: "0.75rem",
              }}
            >
              Upload MP3, WAV, or FLAC — auto-converted via FFmpeg for Tesla
              compatibility.
            </div>
            {dropTarget === "horn" && (
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--orange)",
                  background: "var(--orange-bg)",
                  border: "1px solid var(--orange)",
                  borderRadius: "6px",
                  padding: "0.5rem 0.75rem",
                  marginBottom: "0.75rem",
                }}
              >
                Legal notice: Custom horn sounds must comply with local traffic
                laws. Use responsibly on public roads.
              </div>
            )}
            <div
              style={{
                border: "2px dashed var(--border)",
                borderRadius: "8px",
                padding: "1.25rem",
                textAlign: "center",
                cursor: "pointer",
                background: dragOver ? "var(--surface-2)" : "transparent",
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {dropFile ? (
                <div style={{ fontSize: "0.8rem" }}>
                  {dropFile.name} ({Math.round(dropFile.bytes.length / 1024)} KB)
                </div>
              ) : (
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  Drop an audio file here (MP3, WAV, FLAC)
                </div>
              )}
            </div>
            {dropFile && (
              <div className="flex gap-1" style={{ marginTop: "0.5rem" }}>
                <select
                  className="input-sm"
                  value={dropTarget}
                  onChange={(ev) => setDropTarget(ev.target.value as AudioTarget)}
                >
                  <option value="horn">Horn</option>
                  <option value="lock_chime">Lock Chime</option>
                </select>
                <button
                  className="btn btn-primary btn-sm"
                  disabled={uploading || !!pendingUploadConfirmation}
                  onClick={handleUpload}
                >
                  {uploading ? "Installing..." : "Install Custom"}
                </button>
              </div>
            )}
            {uploadMsg && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  marginTop: "0.5rem",
                  fontSize: "0.75rem",
                  color: uploadMsg.startsWith("Error")
                    ? "var(--accent)"
                    : "var(--green)",
                }}
              >
                {uploadMsg}
              </div>
            )}
          </div>
        </div>
      )}

      {showLightshows && (
        <div style={{ marginTop: 0 }}>
          <Lighthouse embedded />
        </div>
      )}

      {showMusic && pendingSongInstall && (
        <div className="modal-overlay" onClick={() => setPendingSongInstall(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Choose Install Target</div>
            <div className="modal-desc">
              Install <strong>{pendingSongInstall.entry.name}</strong> as:
            </div>
            <div className="modal-warning">
              <div className="modal-warning-icon">!</div>
              <div>
                <div className="modal-warning-label">USB Destination</div>
                <div className="modal-warning-text">
                  <div>
                    Horn:{" "}
                    {
                      confirmMarketplaceSongInstall(
                        pendingSongInstall,
                        "horn",
                      ).destinationPath
                    }
                  </div>
                  <div style={{ marginTop: "0.35rem" }}>
                    Lock Chime:{" "}
                    {
                      confirmMarketplaceSongInstall(
                        pendingSongInstall,
                        "lock_chime",
                      ).destinationPath
                    }
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions" style={{ flexWrap: "wrap" }}>
              <button
                className="btn btn-primary"
                onClick={() => handleConfirmSongInstall("horn")}
              >
                Install as Horn
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => handleConfirmSongInstall("lock_chime")}
              >
                Install as Lock Chime
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setPendingSongInstall(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showMusic && pendingUploadConfirmation && (
        <div
          className="modal-overlay"
          onClick={() => {
            if (!uploading) {
              setPendingUploadConfirmation(null);
            }
          }}
        >
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Confirm Custom Install</div>
            <div className="modal-desc">
              You are about to install{" "}
              <strong>{pendingUploadConfirmation.dropFile.name}</strong> to:
            </div>
            <div className="modal-warning">
              <div className="modal-warning-icon">!</div>
              <div>
                <div className="modal-warning-label">Destination</div>
                <div className="modal-warning-text">
                  <div>{pendingUploadConfirmation.destinationPath}</div>
                  <div style={{ marginTop: "0.35rem" }}>
                    Target: {audioTargetLabel(pendingUploadConfirmation.target)}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                disabled={uploading}
                onClick={handleConfirmUpload}
              >
                {uploading ? "Installing..." : "Confirm Install"}
              </button>
              <button
                className="btn btn-ghost"
                disabled={uploading}
                onClick={() => setPendingUploadConfirmation(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
