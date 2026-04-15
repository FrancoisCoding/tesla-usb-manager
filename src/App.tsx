import { useEffect, useState } from "react";
import "./App.css";
import Dashboard from "./screens/Dashboard";
import Marketplace from "./screens/Marketplace";

export type Screen = "dashboard" | "marketplace";

// SVG icon helpers
type UsbIconVariant = "minimal" | "rounded" | "bold";

const SIDEBAR_USB_ICON_VARIANT: UsbIconVariant = "minimal";

function UsbIconMinimal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="sidebar-brand-usb-icon" aria-hidden="true">
      <rect x="6.5" y="8" width="11" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="8.8" y="10.5" width="2.8" height="5.2" rx="0.8" fill="currentColor" />
      <rect x="12.4" y="10.5" width="2.8" height="5.2" rx="0.8" fill="currentColor" />
      <path
        d="M12 8V3.7m0 0l-1.8 1.8m1.8-1.8l1.8 1.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="3.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function UsbIconRounded() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="sidebar-brand-usb-icon" aria-hidden="true">
      <rect x="5.5" y="7.2" width="13" height="11.3" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <rect x="8.25" y="10.2" width="3" height="5.2" rx="1.1" fill="currentColor" />
      <rect x="12.75" y="10.2" width="3" height="5.2" rx="1.1" fill="currentColor" />
      <path
        d="M12 7.2V3.9m0 0l-1.55 1.55M12 3.9l1.55 1.55"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="3.4" r="1.2" fill="currentColor" />
    </svg>
  );
}

function UsbIconBold() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="sidebar-brand-usb-icon" aria-hidden="true">
      <path d="M9.3 7.1a1.2 1.2 0 0 1 1.2 1.2V16a2.5 2.5 0 0 0 2.5 2.5h1.6a2.9 2.9 0 0 0 2.9-2.9V9.8a2.7 2.7 0 0 0-2.7-2.7H9.3Zm2.5 2.8h1.2a.8.8 0 0 1 .8.8v3.3a.8.8 0 0 1-.8.8h-1.2a.8.8 0 0 1-.8-.8v-3.3a.8.8 0 0 1 .8-.8Zm3.2 0h1.2a.8.8 0 0 1 .8.8v3.3a.8.8 0 0 1-.8.8H15a.8.8 0 0 1-.8-.8v-3.3a.8.8 0 0 1 .8-.8Z" />
      <path d="M12 2.5a1.2 1.2 0 0 1 1.2 1.2V5h.6a.9.9 0 0 1 .63 1.54l-1.77 1.77a.9.9 0 0 1-1.28 0L9.59 6.54A.9.9 0 0 1 10.22 5H11V3.7A1.2 1.2 0 0 1 12 2.5Z" />
    </svg>
  );
}

function IconUSB() {
  if (SIDEBAR_USB_ICON_VARIANT === "rounded") return <UsbIconRounded />;
  if (SIDEBAR_USB_ICON_VARIANT === "bold") return <UsbIconBold />;
  return <UsbIconMinimal />;
}
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
        <IconUSB />
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
