import { useEffect, useState } from "react";
import "./App.css";
import Dashboard from "./screens/Dashboard";
import Marketplace from "./screens/Marketplace";

export type Screen = "dashboard" | "marketplace";

// SVG icon helpers
function IconHome() {
  return <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 7h2v8h4v-4h2v4h4V7h2L8 1z"/></svg>;
}
function IconMarket() {
  return <svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 2h14v2H1V2zm0 3h14v9H1V5zm2 2v5h10V7H3zm2 1h6v1H5V8zm0 2h4v1H5v-1z"/></svg>;
}
function AppSidebar({
  screen,
  onNavigate,
  marketplaceEnabled,
}: {
  screen: Screen;
  onNavigate: (s: Screen) => void;
  marketplaceEnabled: boolean;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-name">Tesla USB Manager</div>
      </div>
      <nav className="sidebar-nav">
        <button className={`sidebar-item ${screen === "dashboard" ? "active" : ""}`} onClick={() => onNavigate("dashboard")}>
          <IconHome /> Step 1: USB Setup
        </button>
        <button
          className={`sidebar-item ${screen === "marketplace" ? "active" : ""}`}
          onClick={() => onNavigate("marketplace")}
          disabled={!marketplaceEnabled}
        >
          <IconMarket /> Step 2: Marketplace
        </button>
      </nav>
    </aside>
  );
}

function App() {
  const [screen, setScreen] = useState("dashboard" as Screen);
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(false);

  useEffect(() => {
    if (!marketplaceEnabled && screen === "marketplace") {
      setScreen("dashboard");
    }
  }, [marketplaceEnabled, screen]);

  function handleNavigate(next: Screen) {
    if (next === "marketplace" && !marketplaceEnabled) {
      return;
    }
    setScreen(next);
  }

  return (
    <div className="app-shell">
      <AppSidebar
        screen={screen}
        onNavigate={handleNavigate}
        marketplaceEnabled={marketplaceEnabled}
      />
      <div className="main-area">
        {screen === "dashboard" && (
          <Dashboard
            onNavigate={handleNavigate}
            onSetupReadyChange={setMarketplaceEnabled}
          />
        )}
        {screen === "marketplace" && <Marketplace />}
      </div>
    </div>
  );
}

export default App;
