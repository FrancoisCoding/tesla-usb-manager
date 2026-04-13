import { useState, useEffect, useCallback } from "react";
import { fetchLightShows, downloadInstallLightShow, youtubeThumbnail, youtubeVideoId } from "../lightshow/teslalightshare";
import type { LightShowEntry, FetchLightShowsRequest } from "../lightshow/teslalightshare";
import { installLightShow } from "../lightshow/tauri";

const CATS = [
  { label: "All", value: "all" },
  { label: "Halloween", value: "1" },
  { label: "Christmas", value: "2" },
  { label: "Themes", value: "3" },
  { label: "Fun", value: "4" },
];

const SORTS = [
  { label: "Trending", type: "hot", order: "desc" },
  { label: "Most Downloads", type: "downloads", order: "desc" },
  { label: "Newest", type: "date", order: "desc" },
  { label: "Top Voted", type: "votes", order: "desc" },
];

export default function Lighthouse() {
  const [entries, setEntries] = useState([] as LightShowEntry[]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null as string | null);
  const [search, setSearch] = useState("");
  const [debSearch, setDebSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sortIdx, setSortIdx] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null as LightShowEntry | null);
  const [usbPath, setUsbPath] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installMsg, setInstallMsg] = useState(null as string | null);
  const [tasPath, setTasPath] = useState("");
  const [tasInstalling, setTasInstalling] = useState(false);
  const [tasMsg, setTasMsg] = useState(null as string | null);

  useEffect(() => {
    const timer = setTimeout(() => setDebSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const loadShows = useCallback(async () => {
    setLoading(true); setErr(null);
    const sort = SORTS[sortIdx];
    const req: FetchLightShowsRequest = { page, sortType: sort.type, sortOrder: sort.order,
      category: category === "all" ? undefined : category, search: debSearch || undefined };
    try { const resp: any = await fetchLightShows(req); setEntries(resp.entries || []); }
    catch (e) { setErr(String(e)); }
    finally { setLoading(false); }
  }, [page, category, sortIdx, debSearch]);

  useEffect(() => { loadShows(); }, [loadShows]);

  async function handleInstall() {
    if (!selected || !usbPath.trim()) return;
    setInstalling(true); setInstallMsg(null);
    try {
      const result: any = await downloadInstallLightShow({ showId: selected.id,
        usbMountPath: usbPath.trim(), showName: selected.title, overwriteExisting: false });
      setInstallMsg("Installed: " + result.installedPath + " (" + Math.round(result.bytes/1024) + " KB)");
    } catch (e) { setInstallMsg("Error: " + String(e)); }
    finally { setInstalling(false); }
  }

  async function handleInstallCustomTas() {
    if (!tasPath.trim() || !usbPath.trim()) return;
    setTasInstalling(true);
    setTasMsg(null);
    try {
      const result: any = await installLightShow({ sourcePath: tasPath.trim(), usbMountPath: usbPath.trim(), overwriteExisting: false });
      setTasMsg("Installed: " + result.installedPath);
    } catch (e) {
      setTasMsg("Error: " + String(e));
    } finally {
      setTasInstalling(false);
    }
  }
  return (
    <div className="content" style={{ display: "flex", gap: "1rem", overflow: "hidden", height: "100%" }}>
      <div style={{ flex: 1, overflow: "auto" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: "0.75rem" }}>
          <input
            className="input-sm" style={{ flex: 1 }}
            placeholder="Search light shows..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="flex items-center justify-between" style={{ marginBottom: "0.75rem" }}>
          <div className="filter-tabs" style={{ borderBottom: "none", marginBottom: 0 }}>
            {CATS.map((cat) => (
              <button key={cat.value} className={cat.value === category ? "filter-tab active" : "filter-tab"}
                onClick={() => { setCategory(cat.value); setPage(1); }}>{cat.label}</button>
            ))}
          </div>
          <select style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "6px", padding: "0.3rem 0.5rem", fontSize: "0.74rem" }}
            value={sortIdx} onChange={(e) => { setSortIdx(Number(e.target.value)); setPage(1); }}>
            {SORTS.map((opt, i) => <option key={i} value={i}>{opt.label}</option>)}
          </select>
        </div>
        {loading && <div className="text-muted" style={{ padding: "1rem", fontSize: "0.85rem" }}>Loading...</div>}
        {err && <div style={{ color: "var(--error)", padding: "1rem", fontSize: "0.8rem" }}>{err}</div>}
        {!loading && !err && entries.length === 0 && <div className="text-muted" style={{ padding: "1rem", fontSize: "0.85rem" }}>No shows found.</div>}
        <div className="show-grid">
          {entries.map((show) => {
            const vid = youtubeVideoId(show.youtubeEmbedUrl);
            const thumb = youtubeThumbnail(vid);
            return (
              <div key={show.id}
                className={selected && selected.id === show.id ? "show-card selected" : "show-card"}
                onClick={() => { setSelected(show); setInstallMsg(null); }}
                style={{ cursor: "pointer" }}>
                <div className="show-thumbnail">
                  {thumb ? <img src={thumb} alt={show.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontSize: "24px" }}>&#127746;</div>}
                  {show.duration && <div className="show-duration">{show.duration}</div>}
                </div>
                <div className="show-info">
                  <div className="show-name">{show.title}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{show.upvotes} votes · {show.downloadCount} DL</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "2px" }}>{show.author}</div>
                </div>
              </div>
            );
          })}
        </div>
        {!loading && entries.length > 0 && (
          <div className="flex items-center gap-1" style={{ marginTop: "0.75rem", justifyContent: "center" }}>
            <button className="btn btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span className="text-sm text-muted">Page {page}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        )}
      </div>
      <div style={{ width: "280px", flexShrink: 0, borderLeft: "1px solid var(--border)", paddingLeft: "1rem", overflow: "auto" }}>
        {selected && (
          <>
            <div style={{ fontWeight: 600, marginBottom: "0.5rem", fontSize: "0.9rem" }}>{selected.title}</div>
            {selected.youtubeEmbedUrl && (
              <iframe src={selected.youtubeEmbedUrl} style={{ width: "100%", aspectRatio: "16/9", border: "none", borderRadius: "6px", marginBottom: "0.75rem" }} allowFullScreen />
            )}
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
              {selected.duration && <span>Duration: {selected.duration} · </span>}{selected.upvotes} votes · {selected.downloadCount} downloads
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>By {selected.author}</div>
            <div style={{ marginBottom: "0.5rem" }}>
              <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.25rem" }}>USB Drive Path</label>
              <input value={usbPath} onChange={(e) => setUsbPath(e.target.value)} placeholder="e.g. D:/"
                style={{ width: "100%", boxSizing: "border-box", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "6px", padding: "0.4rem 0.5rem", fontSize: "0.78rem" }} />
            </div>
            <button className="btn btn-primary btn-sm" style={{ width: "100%" }}
              disabled={!usbPath.trim() || installing} onClick={handleInstall}>
              {installing ? "Installing..." : "Install to Drive"}
            </button>
            {installMsg && (
              <div style={{ marginTop: "0.5rem", fontSize: "0.72rem", color: installMsg.startsWith("Error") ? "var(--error)" : "#4caf50" }}>{installMsg}</div>
            )}
            <hr style={{ margin: "0.75rem 0", border: "none", borderTop: "1px solid var(--border)" }} />
          </>
        )}
        <div style={{ marginBottom: "0.75rem" }}>
          <div style={{ fontWeight: 600, fontSize: "0.82rem", marginBottom: "0.4rem" }}>Import Custom .tas</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>Path to a local .tas file</div>
          <input
            style={{ width: "100%", boxSizing: "border-box", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "6px", padding: "0.4rem 0.5rem", fontSize: "0.75rem", marginBottom: "0.4rem" }}
            placeholder="C:/Users/.../show.tas"
            value={tasPath}
            onChange={(e) => setTasPath(e.target.value)}
          />
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>USB Drive Path</div>
          <input
            style={{ width: "100%", boxSizing: "border-box", background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: "6px", padding: "0.4rem 0.5rem", fontSize: "0.75rem", marginBottom: "0.4rem" }}
            placeholder="e.g. D:/"
            value={usbPath}
            onChange={(e) => setUsbPath(e.target.value)}
          />
          <button className="btn btn-primary btn-sm" style={{ width: "100%", marginBottom: "0.4rem" }}
            disabled={!tasPath.trim() || !usbPath.trim() || tasInstalling} onClick={handleInstallCustomTas}>
            {tasInstalling ? "Installing..." : "Install Custom Show"}
          </button>
          {tasMsg && <div style={{ fontSize: "0.72rem", color: tasMsg.startsWith("Error") ? "var(--error)" : "#4caf50", marginBottom: "0.4rem" }}>{tasMsg}</div>}
          <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
            Light Show Creator: <span style={{ color: "var(--text)", fontFamily: "monospace", fontSize: "0.65rem" }}>github.com/teslamotors/light-show</span>
          </div>
        </div>
      </div>
    </div>
  );
}