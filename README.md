# Tesla USB Manager

Desktop utility for preparing Tesla-compatible USB drives and installing Marketplace media (music and light shows) with guided setup.

## Open Source

This repository is fully open source under the MIT License. See `LICENSE`.

## Prerequisites

- Node.js 20+
- Rust stable toolchain
- Tauri prerequisites for your OS: <https://tauri.app/start/prerequisites/>

## Local Development

```bash
npm install
npm run tauri dev
```

## Frontend Build

```bash
npm run build
```

## Tests

```bash
npm test
```

## UI Notes

- Step 2 (Marketplace) stays disabled until Step 1 validates a Tesla-ready drive.
- Marketplace view tabs are mutually exclusive: `Music` or `Light Shows`.
- USB mount path in Step 2 is read-only and sourced from the selected drive in Step 1.
- Sidebar USB brand icon variants are available in `src/App.tsx` via `SIDEBAR_USB_ICON_VARIANT` (`minimal`, `rounded`, `bold`).

## Sidecar Setup

Place platform binaries in `src-tauri/binaries` before packaging.
See `src-tauri/binaries/README.md` for naming conventions.

## CI

GitHub Actions workflow: `.github/workflows/tauri-build.yml`

- Runs on `macos-latest` and `windows-latest`
- Installs Node and Rust
- Validates frontend build
- Validates Tauri compile with `--no-bundle`
