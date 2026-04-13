import { useState, useEffect, useRef } from "react";
import {
  fetchMarketplaceCatalog,
  downloadMarketplaceAudio,
  processAudioPipeline,
  persistUploadedAudio,
} from "../audio/tauri";
import type { MarketplaceCatalogEntry } from "../audio/tauri";
import type { AudioTarget } from "../audio/pipeline";
import { buildInstallDestination } from "../audio/pipeline";

const ALL_CAT = "All";

export default function Marketplace() {
  const [entries, setEntries] = useState([] as MarketplaceCatalogEntry[]);
  const [loading, setLoading] = useState(false);
  const [catalogErr, setCatalogErr] = useState(null as string | null);
  const [activeTab, setActiveTab] = useState(ALL_CAT);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const [destination, setDestination] = useState("horn" as AudioTarget);
  const [usbPath, setUsbPath] = useState("");
  const audioRef = useRef(null as HTMLAudioElement | null);
  const [playingUrl, setPlayingUrl] = useState(null as string | null);
  const [installing, setInstalling] = useState({} as Record<string, boolean>);
  const [installMsg, setInstallMsg] = useState({} as Record<string, string>);
  const [dragOver, setDragOver] = useState(false);
  const [dropFile, setDropFile] = useState(
    null as { name: string; bytes: number[] } | null,
  );
  const [dropTarget, setDropTarget] = useState("horn" as AudioTarget);
  const [uploadMsg, setUploadMsg] = useState(null as string | null);
  const [uploading, setUploading] = useState(false);

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

  const filtered = entries.filter((e) => {
    const matchTab = activeTab === ALL_CAT || e.category === activeTab;
    return matchTab;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
    if (!usbPath.trim()) {
      setInstallMsg((m) => ({
        ...m,
        [entry.downloadUrl]: "Enter USB path first",
      }));
      return;
    }
    setInstalling((s) => ({ ...s, [entry.downloadUrl]: true }));
    setInstallMsg((m) => ({ ...m, [entry.downloadUrl]: String() }));
    try {
      const dl = await downloadMarketplaceAudio({
        downloadUrl: entry.downloadUrl,
      });
      await processAudioPipeline({
        sourcePath: dl.tempPath,
        usbMountPath: usbPath.trim(),
        target: destination,
        normalize: true,
      });
      setInstallMsg((m) => ({ ...m, [entry.downloadUrl]: "Installed!" }));
    } catch (e) {
      setInstallMsg((m) => ({
        ...m,
        [entry.downloadUrl]: "Error: " + String(e),
      }));
    } finally {
      setInstalling((s) => ({ ...s, [entry.downloadUrl]: false }));
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
    if (!dropFile) return;
    if (!usbPath.trim()) {
      setUploadMsg("Enter USB path first");
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    try {
      const persisted = await persistUploadedAudio({
        fileName: dropFile.name,
        bytes: dropFile.bytes,
      });
      await processAudioPipeline({
        sourcePath: persisted.sourcePath,
        usbMountPath: usbPath.trim(),
        target: dropTarget,
        normalize: true,
      });
      setUploadMsg(
        "Installed to " + buildInstallDestination(usbPath.trim(), dropTarget),
      );
      setDropFile(null);
    } catch (e) {
      setUploadMsg("Error: " + String(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="content">
        <div
          className="flex items-center gap-1"
          style={{ marginBottom: "1rem" }}
        >
          <label className="label-sm" style={{ whiteSpace: "nowrap" }}>
            USB Mount Path
          </label>
          <input
            className="input-sm"
            style={{ flex: 1 }}
            placeholder="/media/usb or D:/"
            value={usbPath}
            onChange={(ev) => setUsbPath(ev.target.value)}
          />
          <select
            className="input-sm"
            value={destination}
            onChange={(ev) => setDestination(ev.target.value as AudioTarget)}
          >
            <option value="horn">Horn</option>
            <option value="lock_chime">Lock Chime</option>
          </select>
        </div>

        <div className="filter-tabs">
          {categories.map((tab) => (
            <button
              key={tab}
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

        {catalogErr && (
          <div
            className="card"
            style={{ color: "var(--accent)", marginBottom: "1rem" }}
          >
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
                    <div className="sound-art">
                      {sound.imageUrl ? (
                        <img
                          src={sound.imageUrl}
                          alt={sound.name}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" />
                        </svg>
                      )}
                    </div>
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
                          className="btn-icon"
                          title="Preview"
                          onClick={() => togglePreview(sound.previewUrl)}
                        >
                          {isPlaying ? "■" : "▶"}
                        </button>
                      )}
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={installing[key]}
                        onClick={() => handleInstall(sound)}
                      >
                        {installing[key] ? "..." : "Install"}
                      </button>
                    </div>
                    {installMsg[key] && (
                      <div
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
        {destination === "horn" && (
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
              disabled={uploading}
              onClick={handleUpload}
            >
              {uploading ? "Installing..." : "Install Custom"}
            </button>
          </div>
        )}
        {uploadMsg && (
          <div
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
  );
}
