import { useState } from "react";
import "./App.css";
import Dashboard from "./screens/Dashboard";
import Marketplace from "./screens/Marketplace";
import Lighthouse from "./screens/Lighthouse";

export type Screen = "dashboard" | "marketplace" | "lighthouse";

// SVG icon helpers
function IconUSB() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="sidebar-brand-usb-icon">
      <path fillRule="evenodd" d="M6 0h4v4h2v8H4V4h2V0zM5.5 5.5h2v4h-2V5.5zm3 0h2v4h-2V5.5z"/>
    </svg>
  );
}
function IconHome() {
  return <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 7h2v8h4v-4h2v4h4V7h2L8 1z"/></svg>;
}
function IconMarket() {
  return <svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 2h14v2H1V2zm0 3h14v9H1V5zm2 2v5h10V7H3zm2 1h6v1H5V8zm0 2h4v1H5v-1z"/></svg>;
}
function AppSidebar({ screen, onNavigate }: { screen: Screen; onNavigate: (s: Screen) => void }) {
  const inMarketplace = screen === "marketplace" || screen === "lighthouse";
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <IconUSB />
        <div className="sidebar-brand-name">Tesla USB Manager</div>
      </div>
      <nav className="sidebar-nav">
        <button className={`sidebar-item ${screen === "dashboard" ? "active" : ""}`} onClick={() => onNavigate("dashboard")}>
          <IconHome /> Dashboard
        </button>
        <button className={`sidebar-item ${inMarketplace ? "active" : ""}`} onClick={() => onNavigate("marketplace")}>
          <IconMarket /> Marketplace
        </button>
      </nav>
    </aside>
  );
}

function App() {
  const [screen, setScreen] = useState("dashboard" as Screen);

  return (
    <div className="app-shell">
      <AppSidebar screen={screen} onNavigate={setScreen} />
      <div className="main-area">
        {screen === "dashboard" && <Dashboard onNavigate={setScreen} />}
        {screen === "marketplace" && <Marketplace onNavigate={setScreen} />}
        {screen === "lighthouse" && <Lighthouse onNavigate={setScreen} />}
      </div>
    </div>
  );
}

export default App;
