import { useState } from "react";
import type { Screen } from "../App";

interface Props {
  onNavigate: (s: Screen) => void;
}

const drives = [
  {
    id: "samsung-t7",
    name: "Samsung T7 Shield",
    recommended: true,
    size: "1.0 TB",
    speed: "1050 MB/s",
    status: "Ready",
    icon: "",
    locked: false,
  },
  {
    id: "sandisk",
    name: "SanDisk Extreme PRO",
    recommended: false,
    size: "256 GB",
    speed: "200 MB/s",
    status: "Partition required",
    icon: "",
    locked: false,
  },
  {
    id: "macintosh",
    name: "Internal Macintosh HD",
    recommended: false,
    size: "",
    speed: "",
    status: "System Drive – Locked",
    icon: "",
    locked: true,
  },
];

export default function SetupDrive({ onNavigate }: Props) {
  const [selectedDrive, setSelectedDrive] = useState("samsung-t7");

  return (
    <div className="flex-col" style={{ height: "100%" }}>
      {/* Step progress bar */}
      <div className="step-bar-container">
        <div className="step-bar-info">
          <span>Step 2 of 5: Preparing hardware for Tesla USB Manager OS</span>
          <span>40%</span>
        </div>
        <div className="step-bar-track">
          <div className="step-bar-fill" />
        </div>
      </div>

      {/* Content */}
      <div className="content">
        <h1 className="page-title" style={{ marginBottom: "0.3rem" }}>Select Drive</h1>
        <p className="page-subtitle" style={{ marginBottom: "1.5rem" }}>Step 2 of 5: Preparing hardware for Tesla USB Manager OS</p>

        <div className="grid-2" style={{ gridTemplateColumns: "1fr 280px", gap: "1.25rem", alignItems: "start" }}>
          {/* Left: drive list */}
          <div className="flex-col gap-1">
            <div className="drive-list">
              {drives.map((drive) => (
                <div
                  key={drive.id}
                  className={`drive-item ${selectedDrive === drive.id ? "selected" : ""} ${drive.locked ? "locked" : ""}`}
                  onClick={() => { if (!drive.locked) setSelectedDrive(drive.id); }}
                >
                  <div className="drive-icon">{drive.icon}</div>
                  <div className="drive-info">
                    <div className="drive-name">
                      {drive.name}
                      {drive.recommended && <span className="tag tag-recommended">Recommended</span>}
                    </div>
                    <div className="drive-specs">
                      {drive.size && <span>📦 {drive.size}</span>}
                      {drive.speed && <span>⬆ {drive.speed}</span>}
                      <span>● {drive.status}</span>
                    </div>
                  </div>
                  <div className={`drive-radio ${selectedDrive === drive.id ? "selected-radio" : ""}`} />
                </div>
              ))}
            </div>

            {/* Perf tip */}
            <div className="perf-tip">
              <div className="perf-tip-label">❤ Performance Tip</div>
              For consistent Sentry Mode recording and Dashcam reliability, we recommend using an SSD with at least 500MB/s write speeds. Tesla USB Manager will automatically format the drive to exFAT.
            </div>
          </div>

          {/* Right: hardware status */}
          <div className="flex-col gap-1">
            <div className="hw-status-panel">
              <div className="hw-status-image">💿</div>
              <div className="hw-status-body">
                <div className="hw-status-label">Hardware Status</div>
                <div className="hw-status-title">Detected 3 connected storage devices.</div>
              </div>
            </div>

            <div className="health-check">
              <div className="health-check-header">
                <span>Health Check</span>
                <span className="text-green">Optimal</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: "92%" }} />
              </div>
              <div className="health-check-pct text-muted">92%</div>
              <div className="health-check-stats">
                <div>
                  <div className="health-stat-label">Bus Speed</div>
                  <div className="health-stat-value">USB 3.2</div>
                </div>
                <div>
                  <div className="health-stat-label">Voltage</div>
                  <div className="health-stat-value">5.01V</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="action-bar">
        <button className="btn btn-ghost" onClick={() => onNavigate("dashboard")}>← Back</button>
        <div className="flex gap-1">
          <button className="btn btn-ghost">Refresh Drives</button>
          <button className="btn btn-primary">Confirm Selection →</button>
        </div>
      </div>
    </div>
  );
}
