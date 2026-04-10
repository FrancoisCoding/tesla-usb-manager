# Tesla USB Manager

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

## Sidecar Setup

Place platform binaries in `src-tauri/binaries` before packaging.
See `src-tauri/binaries/README.md` for naming conventions.

## CI

GitHub Actions workflow: `.github/workflows/tauri-build.yml`

- Runs on `macos-latest` and `windows-latest`
- Installs Node and Rust
- Validates frontend build
- Validates Tauri compile with `--no-bundle`
