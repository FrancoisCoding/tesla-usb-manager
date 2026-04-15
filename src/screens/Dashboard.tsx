import { useState, useEffect } from "react";
import type { Screen } from "../App";
import {
  buildTeslaFormatPlan,
  listUsbDrives,
  prepareTeslaUsbLayout,
} from "../lib/bridge";
import type { UsbDriveCandidate } from "../lib/bridge";
import SafetyModal from "../components/SafetyModal";
import { writeSelectedUsbMountPath } from "../usb/selection";
import {
  canSkipToMarketplace,
  evaluateDriveHealth,
} from "./usbSetupStatus";

const TESLA_FOLDERS = [
  { key: "TeslaCam", desc: "Dashcam recording" },
  { key: "Sentry", desc: "Sentry mode clips" },
  { key: "Music", desc: "Audio files" },
  { key: "LIGHTSHOW", desc: "Light show files" },
];

interface Props {
  onNavigate: (s: Screen) => void;
  onSetupReadyChange: (ready: boolean) => void;
}

export default function Dashboard({ onNavigate, onSetupReadyChange }: Props) {
  const [drives, setDrives] = useState([] as UsbDriveCandidate[]);
  const [selectedId, setSelectedId] = useState(null as string | null);
  const [loadingDrives, setLoadingDrives] = useState(false);
  const [driveErr, setDriveErr] = useState(null as string | null);
  const [showModal, setShowModal] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState(null as string | null);
  const [checkingSetup, setCheckingSetup] = useState(false);
  const [setupErr, setSetupErr] = useState(null as string | null);
  const [missingFolders, setMissingFolders] = useState(null as string[] | null);

  useEffect(() => {
    refreshDrives();
  }, []);

  async function refreshDrives() {
    setLoadingDrives(true);
    setDriveErr(null);
    setApplyMsg(null);
    setSetupErr(null);
    try {
      const result = await listUsbDrives();
      setDrives(result);
      setSelectedId((current) => {
        if (current && result.some((drive) => drive.id === current)) {
          return current;
        }
        return result.length > 0 ? result[0].id : null;
      });
    } catch (e) {
      setDriveErr(String(e));
      onSetupReadyChange(false);
    } finally {
      setLoadingDrives(false);
    }
  }

  const selected = drives.find((d) => d.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    writeSelectedUsbMountPath(selected.mountPath);
  }, [selected?.mountPath]);

  useEffect(() => {
    let cancelled = false;

    if (!selected) {
      setMissingFolders(null);
      setSetupErr(null);
      onSetupReadyChange(false);
      return () => {
        cancelled = true;
      };
    }

    setCheckingSetup(true);
    setSetupErr(null);

    buildTeslaFormatPlan({
      mountPath: selected.mountPath,
      totalBytes: selected.totalBytes,
      expectedFingerprint: selected.id,
    })
      .then((plan) => {
        if (cancelled) return;
        setMissingFolders(plan.foldersToCreate);
        const ready = canSkipToMarketplace(plan.foldersToCreate);
        onSetupReadyChange(ready);
      })
      .catch((error) => {
        if (cancelled) return;
        setMissingFolders(null);
        setSetupErr(String(error));
        onSetupReadyChange(false);
      })
      .finally(() => {
        if (cancelled) return;
        setCheckingSetup(false);
      });

    return () => {
      cancelled = true;
    };
  }, [onSetupReadyChange, selected?.id, selected?.mountPath, selected?.totalBytes]);

  async function handleApplyLayout() {
    if (!selected) return;
    setApplying(true);
    setApplyMsg(null);
    try {
      const result = await prepareTeslaUsbLayout({
        mountPath: selected.mountPath,
        totalBytes: selected.totalBytes,
      });
      const msg =
        result.createdFolders.length > 0
          ? "Configured Tesla folders: " + result.createdFolders.join(", ")
          : "Drive already configured";
      setApplyMsg(msg);
      writeSelectedUsbMountPath(result.mountPath);
      setMissingFolders([]);
      setSetupErr(null);
      onSetupReadyChange(true);
    } catch (e) {
      setApplyMsg("Error: " + String(e));
      onSetupReadyChange(false);
    } finally {
      setApplying(false);
    }
  }

  const totalGb = selected && selected.totalBytes != null
    ? Math.round(selected.totalBytes / 1024 / 1024 / 1024)
    : null;
  const freeGb = selected && selected.freeBytes != null
    ? Math.round(selected.freeBytes / 1024 / 1024 / 1024)
    : null;
  const health = selected
    ? evaluateDriveHealth(selected.totalBytes, selected.freeBytes)
    : null;
  const setupReady = missingFolders !== null && canSkipToMarketplace(missingFolders);
  const setupLabel = setupReady
    ? "Configured"
    : selected
      ? "Needs setup"
      : "No drive selected";
  const setupColor = setupReady ? "var(--green)" : "var(--orange)";

  return (
    <div className="content" style={{ maxWidth: "760px" }}>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.3rem" }}>
          Prepare a Tesla-ready USB drive
        </div>
        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
          Select a drive, confirm Tesla folder compatibility, then continue to Marketplace once setup is complete.
        </div>
      </div>
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div className="flex items-center justify-between" style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>Step 1 of 2: USB Setup</div>
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
                <button
                  type="button"
                  key={drive.id}
                  className={selectedId === drive.id ? "drive-item selected" : "drive-item"}
                  onClick={() => setSelectedId(drive.id)}
                  aria-pressed={selectedId === drive.id}
                  aria-label={`Select drive ${drive.displayName}`}
                >
                  <div className="drive-info">
                    <div className="drive-name">{drive.displayName}</div>
                    <div className="drive-specs">
                      {drive.totalBytes != null && <span>{Math.round(drive.totalBytes / 1024 / 1024 / 1024)} GB</span>}
                      <span>{drive.recommendedFilesystem}</span>
                    </div>
                  </div>
                  <div className={selectedId === drive.id ? "drive-radio selected-radio" : "drive-radio"} />
                </button>
              ))}
            </div>
        }

        {selected && (
          <div className="card-sm" style={{ marginTop: "0.75rem" }}>
            <div className="grid-2" style={{ rowGap: "0.55rem", columnGap: "1rem" }}>
              <div>
                <div className="label-sm">Mount Path</div>
                <div className="text-sm">{selected.mountPath}</div>
              </div>
              <div>
                <div className="label-sm">Filesystem</div>
                <div className="text-sm">{selected.recommendedFilesystem}</div>
              </div>
              <div>
                <div className="label-sm">Capacity</div>
                <div className="text-sm">
                  {totalGb != null ? `${totalGb} GB` : "Unknown"}
                  {freeGb != null ? ` (${freeGb} GB free)` : ""}
                </div>
              </div>
              <div>
                <div className="label-sm">Drive Health</div>
                <div className="text-sm" style={{ color: health?.level === "warning" ? "var(--orange)" : health?.level === "healthy" ? "var(--green)" : "var(--text-muted)" }}>
                  {health?.label ?? "Unknown"} {health ? `- ${health.detail}` : ""}
                </div>
              </div>
              <div>
                <div className="label-sm">Tesla Setup</div>
                <div className="text-sm" style={{ color: setupColor }}>
                  {checkingSetup ? "Checking..." : setupLabel}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.75rem" }}>Configure Drive</div>
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
        {checkingSetup && (
          <div role="status" aria-live="polite" style={{ marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Checking existing Tesla folder setup...
          </div>
        )}
        {setupErr && (
          <div style={{ marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--accent)" }}>
            Setup check failed: {setupErr}
          </div>
        )}
        {setupReady && !setupErr && !checkingSetup && (
          <div style={{ marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--green)" }}>
            Tesla folders already detected. You can skip directly to Step 2.
          </div>
        )}
        {!setupReady && missingFolders && missingFolders.length > 0 && (
          <div style={{ marginBottom: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Missing folders: {missingFolders.join(", ")}
          </div>
        )}
        {applyMsg && (
          <div role="status" aria-live="polite" style={{ marginBottom: "0.5rem", fontSize: "0.75rem", color: applyMsg.startsWith("Error") ? "var(--accent)" : "var(--green)" }}>
            {applyMsg}
          </div>
        )}
        <div className="flex gap-1">
          <button
            className="btn btn-primary btn-sm"
            style={{ marginLeft: "auto" }}
            disabled={!selected || applying}
            onClick={() => setShowModal(true)}
          >
            {applying ? "Configuring..." : "Format, Configure & Apply"}
          </button>
          {setupReady && (
            <button
              className="btn btn-ghost btn-sm"
              disabled={!selected}
              onClick={() => onNavigate("marketplace")}
            >
              Continue to Marketplace
            </button>
          )}
        </div>
      </div>

      {showModal && <SafetyModal onClose={() => setShowModal(false)} onConfirm={handleApplyLayout} drive={selected} />}
    </div>
  );
}
