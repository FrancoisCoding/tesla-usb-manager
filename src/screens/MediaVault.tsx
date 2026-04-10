import type { Screen } from "../App";

interface Props {
  onNavigate: (s: Screen) => void;
}

export default function MediaVault({ onNavigate: _onNavigate }: Props) {
  return (
    <div className="content">
      <h1 className="page-title" style={{ marginBottom: "0.4rem" }}>Media Vault</h1>
      <p className="page-subtitle" style={{ marginBottom: "1.5rem" }}>Customize your Tesla USB Manager experience with custom acoustic signatures and visual sequences.</p>

      <div className="grid-2" style={{ gridTemplateColumns: "1fr 220px", gap: "1.25rem", alignItems: "start" }}>
        {/* Left column */}
        <div className="flex-col gap-2">
          {/* Lock Chimes */}
          <div className="card">
            <div className="section-header">
              <div>
                <div className="label-sm">Audio Signature</div>
                <div className="font-bold" style={{ fontSize: "1.1rem" }}>Lock Chimes</div>
              </div>
              <button className="btn btn-primary btn-sm">⬆ Upload New</button>
            </div>
            <div className="grid-2" style={{ gap: "0.75rem", marginTop: "0.75rem" }}>
              {/* Cyber-Pulsar */}
              <div className="media-card">
                <div className="media-card-badge"><span className="tag tag-installed">INSTALLED</span></div>
                <div className="media-card-thumb"></div>
                <div className="font-bold" style={{ fontSize: "0.8rem" }}>Cyber-Pulsar</div>
                <div className="text-xs text-muted mt-1">1.2 MB • WAV</div>
                <div className="flex justify-between items-center mt-1">
                  <span />
                  <button className="btn-icon" style={{ fontSize: "10px" }}>▶</button>
                </div>
              </div>
              {/* Deep Rumble */}
              <div className="media-card">
                <div className="media-card-badge"><span className="tag tag-pending">PENDING</span></div>
                <div className="media-card-thumb"></div>
                <div className="font-bold" style={{ fontSize: "0.8rem" }}>Deep Rumble</div>
                <div className="text-xs text-muted mt-1">850 KB • MP3</div>
                <div className="flex justify-between items-center mt-1">
                  <span />
                  <button className="btn-icon" style={{ fontSize: "10px" }}>▶</button>
                </div>
              </div>
            </div>
          </div>

          {/* Horn Sounds */}
          <div className="card">
            <div className="section-header" style={{ marginBottom: "0.75rem" }}>
              <div className="font-bold" style={{ fontSize: "1rem" }}>Horn Sounds</div>
              <span style={{ fontSize: "18px", color: "var(--text-muted)" }}></span>
            </div>
            <div className="flex-col gap-1">
              <div className="media-item">
                <div className="media-icon"></div>
                <div className="media-info">
                  <div className="media-name">Standard Horn</div>
                  <div className="media-meta">System Default • 0.2 MB</div>
                </div>
              </div>
              <div className="media-item">
                <div className="media-icon"></div>
                <div className="media-info">
                  <div className="media-name">La Cucaracha</div>
                  <div className="media-meta">Legacy • 2.4 MB</div>
                </div>
              </div>
            </div>
            <button className="btn btn-outline btn-sm mt-2" style={{ fontSize: "0.72rem" }}>
              UPLOAD CUSTOM HORN →
            </button>
          </div>

          {/* Light Shows */}
          <div className="card">
            <div className="section-header" style={{ marginBottom: "0.75rem" }}>
              <div className="font-bold" style={{ fontSize: "1rem" }}>Light Shows</div>
              <span style={{ fontSize: "16px", color: "var(--text-muted)" }}></span>
            </div>
            <div className="grid-2" style={{ gap: "0.75rem" }}>
              <div className="media-card">
                <div className="media-card-badge"><span className="tag tag-active">ACTIVE</span></div>
                <div className="media-card-thumb" style={{ fontSize: "20px" }}></div>
                <div className="font-bold" style={{ fontSize: "0.78rem" }}>Starman Remix</div>
                <div className="text-xs text-muted mt-1">4:12 • 15 MB</div>
              </div>
              <div className="media-card">
                <div className="media-card-badge"><span className="tag tag-preview">PREVIEW</span></div>
                <div className="media-card-thumb" style={{ fontSize: "20px" }}>⬡</div>
                <div className="font-bold" style={{ fontSize: "0.78rem" }}>Cyber-Grid v2</div>
                <div className="text-xs text-muted mt-1">2:45 • 8 MB</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Storage */}
        <div className="card">
          <div className="font-bold" style={{ marginBottom: "0.3rem" }}>Storage</div>
          <div className="text-xs text-muted" style={{ marginBottom: "0.85rem" }}>Available TeslaUSB Space</div>
          <div className="progress-track" style={{ height: "8px", marginBottom: "0.4rem" }}>
            <div className="progress-fill" style={{ width: "50%" }} />
          </div>
          <div className="flex justify-between text-xs" style={{ marginBottom: "1.25rem" }}>
            <span className="text-muted">64.2 GB USED</span>
            <span className="text-dim">128 GB TOTAL</span>
          </div>
          <button className="btn btn-ghost w-full btn-sm">Optimize Library</button>
        </div>
      </div>
    </div>
  );
}
