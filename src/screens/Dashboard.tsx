import { useState, useEffect } from "react";
import type { Screen } from "../App";
import { listUsbDrives, prepareTeslaUsbLayout } from "../lib/bridge";
import type { UsbDriveCandidate } from "../lib/bridge";
import SafetyModal from "../components/SafetyModal";

const TESLA_FOLDERS = [
  { key: "TeslaCam", desc: "Dashcam recording" },
  { key: "Sentry", desc: "Sentry mode clips" },
  { key: "Music", desc: "Audio files" },
  { key: "LIGHTSHOW", desc: "Light show files" },
];

interface Props {
  onNavigate: (s: Screen) => void;
}

export default function Dashboard({ onNavigate }: Props) {
  const [drives, setDrives] = useState([] as UsbDriveCandidate[]);
  const [selectedId, setSelectedId] = useState(null as string | null);
  const [loadingDrives, setLoadingDrives] = useState(false);
  const [driveErr, setDriveErr] = useState(null as string | null);
  const [showModal, setShowModal] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState(null as string | null);
  const [ejected, setEjected] = useState(false);

  useEffect(() => {
    refreshDrives();
  }, []);

  async function refreshDrives() {
    setLoadingDrives(true);
    setDriveErr(null);
    setApplyMsg(null);
    setEjected(false);
    try {
      const result = await listUsbDrives();
      setDrives(result);
      if (result.length > 0) setSelectedId(result[0].id);
      else setSelectedId(null);
    } catch (e) {
      setDriveErr(String(e));
    } finally {
      setLoadingDrives(false);
    }
  }

  const selected = drives.find((d) => d.id === selectedId) ?? null;

  async function handleApplyLayout() {
    if (!selected) return;
    setApplying(true);
    setApplyMsg(null);
    try {
      const result = await prepareTeslaUsbLayout({
        mountPath: selected.mountPath,
        totalBytes: selected.totalBytes,
      });
      const msg = result.createdFolders.length > 0
        ? "Applied: " + result.createdFolders.join(", ")
        : "Drive already configured";
      setApplyMsg(msg);
    } catch (e) {
      setApplyMsg("Error: " + String(e));
    } finally {
      setApplying(false);
    }
  }

  const totalGb = selected && selected.totalBytes != null
    ? Math.round(selected.totalBytes / 1024 / 1024 / 1024)
    : null;
  return (
    <div className="content" style={{ maxWidth: "640px" }}>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>USB Drive</div>
          <button className="btn btn-ghost btn-sm" onClick={refreshDrives} disabled={loadingDrives}>
            {loadingDrives ? "Detecting..." : "Refresh"}
          </button>
        </div>
        {driveErr && (
          <div style={{ color: "var(--accent)", fontSize: "0.78rem", marginBottom: "0.5rem" }}>
            {driveErr}
          </div>
        )}
        {drives.length === 0 && !loadingDrives
          ? <div className="text-muted" style={{ fontSize: "0.8rem", padding: "0.5rem 0" }}>No drives detected. Insert a USB drive and press Refresh.</div>
          : <div className="drive-list">
              {drives.map((drive) => (
                <div
                  key={drive.id}
                  className={selectedId === drive.id ? "drive-item selected" : "drive-item"}
                  onClick={() => setSelectedId(drive.id)}
                >
                  <div className="drive-info">
                    <div className="drive-name">{drive.displayName}</div>
                    <div className="drive-specs">
                      {drive.totalBytes != null && <span>{Math.round(drive.totalBytes / 1024 / 1024 / 1024)} GB</span>}
                      <span>{drive.recommendedFilesystem}</span>
                    </div>
                  </div>
                  <div className={selectedId === drive.id ? "drive-radio selected-radio" : "drive-radio"} />
                </div>
              ))}
            </div>
        }
      </div>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.75rem" }}>Tesla Folder Structure</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
          {TESLA_FOLDERS.map((f) => (
            <div key={f.key} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.6rem 0.75rem" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, fontFamily: "monospace" }}>{f.key}/</div>
              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>{f.desc}</div>
            </div>
          ))}
        </div>
        {selected && totalGb != null && (
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            Recommended: <strong style={{ color: "var(--text)" }}>{selected.recommendedFilesystem}</strong> ({totalGb} GB)
          </div>
        )}
        <div className="flex gap-1">
          <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} disabled={!selected || applying} onClick={() => setShowModal(true)}>
            Format &amp; Configure
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.5rem" }}>Apply &amp; Eject</div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
          Write the Tesla folder structure to your USB drive, then safely eject it.
        </div>
        {applyMsg && (
          <div style={{ marginBottom: "0.5rem", fontSize: "0.75rem", color: applyMsg.startsWith("Error") ? "var(--accent)" : "var(--green)" }}>
            {applyMsg}
          </div>
        )}
        {ejected && <div style={{ marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--green)" }}>Drive ejected — safe to remove.</div>}
        <div className="flex gap-1">
          <button className="btn btn-primary btn-sm" disabled={!selected || applying} onClick={handleApplyLayout}>
            {applying ? "Applying..." : "Apply to Drive"}
          </button>
          <button className="btn btn-ghost btn-sm" disabled={!selected} onClick={() => setEjected(true)}>
            Eject and Go
          </button>
        </div>
      </div>

      <button className="quick-action-card featured" onClick={() => onNavigate("marketplace")}>
        <div style={{ flexShrink: 0, width: "1.5rem", height: "1.5rem" }} />
        <div style={{ flex: 1 }}>
          <div className="quick-action-title">Browse Marketplace</div>
          <div className="quick-action-sub">Install horn sounds, lock chimes &amp; light shows</div>
        </div>
        <div style={{ fontSize: "1.1rem", opacity: 0.4, flexShrink: 0 }}>→</div>
      </button>

      {showModal && <SafetyModal onClose={() => setShowModal(false)} onConfirm={handleApplyLayout} />}
    </div>
  );
}